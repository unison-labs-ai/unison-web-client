import type { TranscriptTurn } from "@/lib/session-transcript";
import { recordValue, stringListValue, stringValue, type ToolPart } from "@/lib/session-transcript";

import { moduleToolSpec } from "./registry";
import type {
	DocumentModule,
	EmailDraftContent,
	EmailModule,
	Module,
	ModuleStatus,
	ReportModule,
} from "./types";

// ---------------------------------------------------------------------------
// Pure projection of the transcript's tool parts into session modules (plan
// §6.3). Recomputed via useMemo over `turns`, which already fold the live
// stream — no extra stream wiring. A create makes an optimistic module from its
// streamed input (`tool:<callId>`) that resolves to the durable id when the tool
// completes; an edit re-merges into the existing module (no duplicate tab).
// ---------------------------------------------------------------------------

export interface DerivedModules {
	byId: Map<string, Module>;
	/** chip(callId) → tab(moduleId), so a chip can focus its module. */
	moduleIdByCallId: Map<string, string>;
	modules: Module[];
	/** Call id of the last module-producing tool part — a per-touch trigger so the
	 * provider re-surfaces/auto-focuses on every create or edit, not just id change. */
	lastTouchedCallId: string | null;
	/** The module the agent most recently produced/edited — drives auto-focus. */
	lastTouchedId: string | null;
}

const EMPTY: DerivedModules = {
	byId: new Map(),
	lastTouchedCallId: null,
	lastTouchedId: null,
	moduleIdByCallId: new Map(),
	modules: [],
};

export function deriveModules(turns: TranscriptTurn[]): DerivedModules {
	const byId = new Map<string, Module>();
	const moduleIdByCallId = new Map<string, string>();
	let seq = 0;
	let lastTouchedId: string | null = null;
	let lastTouchedCallId: string | null = null;

	for (const tool of toolPartsInOrder(turns)) {
		const spec = moduleToolSpec(tool.tool);

		if (!spec) {
			continue;
		}

		const input = recordValue(tool.input);
		const output = recordValue(tool.output);
		const finalId = spec.idFromOutput?.(output) ?? null;
		const inputId = spec.idFromInput?.(input) ?? null;

		if (spec.isEdit) {
			// Edits re-merge into the existing module; an edit of something not
			// created in this transcript has no tab to update, so it's ignored.
			const targetId = finalId ?? inputId;
			const existing = targetId ? byId.get(targetId) : undefined;

			if (!existing) {
				continue;
			}

			const merged = buildModule(
				spec.kind,
				existing.id,
				existing.seq,
				tool,
				input,
				output,
				existing,
			);
			byId.set(existing.id, merged);
			moduleIdByCallId.set(tool.callId, existing.id);
			lastTouchedId = existing.id;
			lastTouchedCallId = tool.callId;
			continue;
		}

		// Creates: durable id once completed, else an optimistic `tool:<callId>`.
		const optimisticId = `tool:${tool.callId}`;
		const id = finalId ?? optimisticId;
		const existing = byId.get(id) ?? byId.get(optimisticId);
		const nextSeq = existing?.seq ?? seq++;
		const built = buildModule(spec.kind, id, nextSeq, tool, input, output, existing);

		// Drop the optimistic stub once the durable id is known.
		if (existing && existing.id !== built.id) {
			byId.delete(existing.id);
		}

		byId.set(built.id, built);
		moduleIdByCallId.set(tool.callId, built.id);
		lastTouchedId = built.id;
		lastTouchedCallId = tool.callId;
	}

	if (byId.size === 0) {
		return EMPTY;
	}

	const modules = [...byId.values()].sort((left, right) => left.seq - right.seq);
	return { byId, lastTouchedCallId, lastTouchedId, moduleIdByCallId, modules };
}

function toolPartsInOrder(turns: TranscriptTurn[]): ToolPart[] {
	const parts: ToolPart[] = [];

	for (const turn of turns) {
		for (const part of turn.parts) {
			if (part.kind === "tool") {
				parts.push(part.tool);
			}
		}
	}

	return parts;
}

function statusOf(tool: ToolPart): ModuleStatus {
	if (tool.status === "error") {
		return "error";
	}

	return tool.status === "completed" ? "ready" : "streaming";
}

function mergeCallIds(existing: Module | undefined, callId: string): string[] {
	if (!existing) {
		return [callId];
	}

	return existing.callIds.includes(callId) ? existing.callIds : [...existing.callIds, callId];
}

function buildModule(
	kind: Module["kind"],
	id: string,
	seq: number,
	tool: ToolPart,
	input: Record<string, unknown> | undefined,
	output: Record<string, unknown> | undefined,
	existing: Module | undefined,
): Module {
	const base = {
		callIds: mergeCallIds(existing, tool.callId),
		id,
		seq,
		status: statusOf(tool),
	};

	if (kind === "document") {
		const prior = existing?.kind === "document" ? existing : undefined;
		const documentId =
			stringValue(output, "documentId") ??
			stringValue(input, "documentId") ??
			prior?.documentId ??
			null;
		const draftMarkdown = stringValue(input, "content") ?? prior?.draftMarkdown ?? "";
		const title =
			stringValue(output, "title") ??
			stringValue(input, "title") ??
			prior?.title ??
			"Untitled document";
		const module: DocumentModule = { ...base, documentId, draftMarkdown, kind: "document", title };
		return module;
	}

	if (kind === "email") {
		const prior = existing?.kind === "email" ? existing : undefined;
		const draft = recordValue(output?.draft);
		const source = draft ?? input;
		const email = mergeEmail(prior?.email, source);
		const artifactId =
			(draft ? stringValue(draft, "id") : null) ??
			stringValue(output, "artifactId") ??
			stringValue(input, "draftId") ??
			prior?.artifactId ??
			null;
		const module: EmailModule = {
			...base,
			artifactId,
			email,
			kind: "email",
			title: email.subject.trim().length > 0 ? email.subject : "Email draft",
		};
		return module;
	}

	const prior = existing?.kind === "report" ? existing : undefined;
	const payload = recordValue(recordValue(output?.artifact)?.payload);
	const markdown =
		stringValue(payload, "bodyMarkdown") ??
		stringValue(input, "bodyMarkdown") ??
		prior?.markdown ??
		"";
	const reportTitle =
		stringValue(input, "title") ??
		stringValue(recordValue(output?.artifact), "title") ??
		prior?.title ??
		"Artifact";
	const module: ReportModule = {
		...base,
		artifactId: stringValue(recordValue(output?.artifact), "id") ?? prior?.artifactId ?? null,
		kind: "report",
		markdown,
		title: reportTitle,
	};
	return module;
}

function mergeEmail(
	prior: EmailDraftContent | undefined,
	source: Record<string, unknown> | undefined,
): EmailDraftContent {
	const has = (key: string) => Boolean(source && Object.hasOwn(source, key));
	const kindValue = stringValue(source, "kind");

	return {
		bcc: has("bcc") ? stringListValue(source, "bcc") : (prior?.bcc ?? []),
		body: stringValue(source, "body") ?? prior?.body ?? "",
		cc: has("cc") ? stringListValue(source, "cc") : (prior?.cc ?? []),
		gmailMessageId: stringValue(source, "gmailMessageId") ?? prior?.gmailMessageId,
		gmailThreadId: stringValue(source, "gmailThreadId") ?? prior?.gmailThreadId,
		kind: kindValue === "reply" ? "reply" : (prior?.kind ?? "new"),
		subject: stringValue(source, "subject") ?? prior?.subject ?? "",
		to: stringValue(source, "to") ?? prior?.to ?? "",
	};
}
