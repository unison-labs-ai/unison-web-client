import { z } from "zod";

// ---------------------------------------------------------------------------
// Session trigger reference — the typed contract for the first message of any
// triggered session (automation run, capture, scheduled follow-up). The
// message carries the triggering source as data: ids for tool fetch in a
// trusted reference block, display fields inside an untrusted fence. It never
// carries instructions; those live in the session's assignment block in the
// system prompt.
// ---------------------------------------------------------------------------

export const SESSION_TRIGGER_REFERENCE_MESSAGE_KIND = "trigger_reference";

export const sessionTriggerReferenceKindSchema = z.enum([
	"automation_call",
	"capture",
	"connector_event",
	"manual_run",
	"schedule",
]);

export const sessionTriggerReferenceSchema = z.object({
	kind: sessionTriggerReferenceKindSchema,
	occurredAt: z.string().trim().min(1),
	source: z
		.object({
			sourceEventId: z.string().trim().min(1).optional(),
			provider: z.string().trim().min(1).optional(),
			eventType: z.string().trim().min(1).optional(),
			externalIds: z.record(z.string(), z.string()).optional(),
		})
		.optional(),
	display: z.object({
		title: z.string().optional(),
		actor: z.string().optional(),
		snippet: z.string().optional(),
	}),
});

export type SessionTriggerReferenceKind = z.infer<typeof sessionTriggerReferenceKindSchema>;
export type SessionTriggerReference = z.infer<typeof sessionTriggerReferenceSchema>;

const SNIPPET_MAX_CHARS = 500;

function capped(value: string, max: number): string {
	const trimmed = value.trim();

	return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function headlineFor(reference: SessionTriggerReference): string {
	switch (reference.kind) {
		case "connector_event":
			return `A new ${reference.source?.eventType ?? "connector"} event triggered this run.`;
		case "schedule":
			return `A scheduled trigger fired at ${reference.occurredAt}.`;
		case "manual_run":
			return "The user manually started this run.";
		case "automation_call":
			return reference.display.actor
				? `Automation "${reference.display.actor}" called this automation.`
				: "Another automation called this automation.";
		case "capture":
			return "A new capture was saved.";
	}
}

function sourceReferenceLines(reference: SessionTriggerReference): string[] {
	const source = reference.source;
	const lines: string[] = [];

	if (source?.sourceEventId) {
		lines.push(`sourceEventId: ${source.sourceEventId}`);
	}

	for (const [key, value] of Object.entries(source?.externalIds ?? {})) {
		if (value.trim().length > 0) {
			lines.push(`${key}: ${value}`);
		}
	}

	if (lines.length > 0) {
		lines.push(`occurredAt: ${reference.occurredAt}`);
	}

	return lines;
}

function untrustedContentLines(reference: SessionTriggerReference): string[] {
	const lines: string[] = [];

	if (reference.display.actor?.trim()) {
		lines.push(`from: ${capped(reference.display.actor, 200)}`);
	}

	if (reference.display.title?.trim()) {
		lines.push(`title: ${capped(reference.display.title, 300)}`);
	}

	if (reference.display.snippet?.trim()) {
		lines.push(`snippet: ${capped(reference.display.snippet, SNIPPET_MAX_CHARS)}`);
	}

	return lines;
}

// Serialize a trigger reference as the model-facing message text. Trusted ids
// and untrusted display content are fenced separately so the trust layering is
// structural, not implied.
export function renderSessionTriggerReferenceMessage(reference: SessionTriggerReference): string {
	const referenceLines = sourceReferenceLines(reference);
	const contentLines = untrustedContentLines(reference);
	const blocks = [headlineFor(reference)];

	if (referenceLines.length > 0) {
		blocks.push(["<source_reference>", ...referenceLines, "</source_reference>"].join("\n"));
	}

	if (contentLines.length > 0) {
		blocks.push(
			["<source_content_untrusted>", ...contentLines, "</source_content_untrusted>"].join("\n"),
		);
	}

	return blocks.join("\n\n");
}
