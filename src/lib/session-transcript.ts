import { toolRowLabel } from "@unison/client-core";
import type { ThreadMessage } from "@unison/contracts";

import type { StreamEventRecord } from "./stream-events";

export type ToolStatus = "pending" | "running" | "completed" | "error";

export type ToolPart = {
	callId: string;
	errorText?: string;
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
	outputTruncated?: boolean;
	status: ToolStatus;
	tool: string;
};

export type AssistantPart =
	| {
			id: string;
			kind: "input-request";
			inputSchema: Record<string, unknown> | null;
			prompt: string;
	  }
	| { id: string; kind: "text"; source: "message" | "stream"; text: string }
	| { id: string; kind: "tool"; tool: ToolPart };

export type TurnActivity = {
	streaming: boolean;
	summary: string | null;
};

export type TurnRuntime = {
	activity: TurnActivity;
	parts: AssistantPart[];
	textSealed: boolean;
};

export type TranscriptTurn = {
	activity: TurnActivity;
	assistantMessages: ThreadMessage[];
	id: string;
	looseMessages: ThreadMessage[];
	parts: AssistantPart[];
	userMessage: ThreadMessage | null;
	visibleTextStreaming: boolean;
};

export type ToolPresentation = {
	defaultOpen: boolean;
	icon: "bell" | "calendar" | "file" | "globe" | "mail" | "people" | "search" | "tag" | "tool";
	label: string;
};

const IDLE_ACTIVITY: TurnActivity = { streaming: false, summary: null };

export function emptyTurnRuntime(streaming = false): TurnRuntime {
	return { activity: { streaming, summary: null }, parts: [], textSealed: false };
}

export function buildTranscriptTurns(
	messages: ThreadMessage[],
	records: StreamEventRecord[],
): TranscriptTurn[] {
	const runtimeByTurn = buildTurnRuntime(records);
	const turns = buildTurnsFromMessages(messages, runtimeByTurn);
	const turnIds = new Set(turns.map((turn) => turn.id));

	for (const [turnId, runtime] of Object.entries(runtimeByTurn)) {
		if (turnIds.has(turnId)) {
			continue;
		}

		turns.push({
			activity: runtime.activity,
			assistantMessages: [],
			id: turnId,
			looseMessages: [],
			parts: runtime.parts,
			userMessage: null,
			visibleTextStreaming: isRuntimeVisibleTextStreaming(runtime),
		});
	}

	return turns;
}

export function shouldShowActivitySummary(
	turn: Pick<TranscriptTurn, "activity" | "visibleTextStreaming">,
): boolean {
	return turn.activity.streaming && !turn.visibleTextStreaming;
}

export function runningToolLabel(parts: AssistantPart[]): string | undefined {
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const part = parts[index];

		if (
			part?.kind === "tool" &&
			(part.tool.status === "running" || part.tool.status === "pending")
		) {
			return toolRowLabel(part.tool.tool);
		}
	}

	return undefined;
}

export function toolPresentation(name: string): ToolPresentation {
	const presentation = TOOL_PRESENTATIONS[name];

	if (presentation) {
		return presentation;
	}

	return {
		defaultOpen: false,
		icon: "tool",
		label: `Called ${humanizeToolName(name)}`,
	};
}

export function summarizeToolResult(tool: ToolPart): string | undefined {
	if (tool.status === "pending") {
		return "Pending approval";
	}

	if (tool.status === "error") {
		return "Failed";
	}

	if (tool.status !== "completed") {
		return undefined;
	}

	switch (tool.tool) {
		case "web.search": {
			const count = listValue(recordValue(tool.output), "results").length;
			return count === 1 ? "1 result" : `${count} results`;
		}
		case "connector.google.gmail.searchMessages": {
			const count = listValue(recordValue(tool.output), "messages").length;
			return count === 1 ? "1 message" : `${count} messages`;
		}
		case "connector.google.gmail.listLabels": {
			const count = listValue(recordValue(tool.output), "labels").length;
			return count === 1 ? "1 label" : `${count} labels`;
		}
		case "connector.google.people.search": {
			const count = listValue(recordValue(tool.output), "people").length;
			return count === 1 ? "1 contact" : `${count} contacts`;
		}
		case "connector.google.gmail.getMessage":
		case "connector.google.calendar.getEvent":
			return "Read";
		case "connector.google.gmail.addLabel":
			return "Label added";
		case "connector.google.gmail.removeLabel":
			return "Label removed";
		case "connector.google.calendar.listEvents": {
			const count = listValue(recordValue(tool.output), "events").length;
			return count === 1 ? "1 event" : `${count} events`;
		}
		case "connector.google.calendar.freeBusy": {
			const count = listValue(recordValue(tool.output), "busy").length;
			return count === 1 ? "1 busy block" : `${count} busy blocks`;
		}
		case "connector.google.calendar.createEvent":
			return "Event created";
		case "connector.google.calendar.updateEvent":
			return "Event updated";
		case "connector.google.calendar.deleteEvent":
			return "Event deleted";
		case "artifact.create":
			return "Artifact created";
		case "artifact.update":
			return "Artifact updated";
		case "artifact.appendTableRows": {
			const output = recordValue(tool.output);
			const count = Number(output?.appendedRows ?? 0);
			return count === 1 ? "1 row appended" : `${count} rows appended`;
		}
		case "connector.google.gmail.createDraft":
		case "email.draft.create":
			return "Draft created";
		case "email.draft.update":
			return "Draft updated";
		default:
			return undefined;
	}
}

export function recordValue(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

export function stringValue(
	source: Record<string, unknown> | null | undefined,
	key: string,
): string | undefined {
	const value = source?.[key];
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function listValue(
	source: Record<string, unknown> | null | undefined,
	key: string,
): unknown[] {
	const value = source?.[key];
	return Array.isArray(value) ? value : [];
}

export function stringListValue(
	source: Record<string, unknown> | null | undefined,
	key: string,
): string[] {
	return listValue(source, key).filter(
		(item): item is string => typeof item === "string" && item.trim().length > 0,
	);
}

function isPendingApprovalOutput(output: Record<string, unknown> | undefined): boolean {
	return stringValue(output, "code") === "needs_approval";
}

export function formatDisplayValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "-";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function applyTurnEvent(runtime: TurnRuntime, event: TurnEvent): TurnRuntime {
	switch (event.kind) {
		case "text": {
			const parts = runtime.parts.slice();
			const last = parts[parts.length - 1];

			if (last?.kind === "text" && !runtime.textSealed) {
				parts[parts.length - 1] = { ...last, text: last.text + event.delta };
			} else {
				parts.push({
					id: `${event.messageId}:${parts.length}`,
					kind: "text",
					source: "stream",
					text: event.delta,
				});
			}

			return {
				...runtime,
				activity: { ...runtime.activity, streaming: true },
				parts,
				textSealed: false,
			};
		}
		case "text-completed":
			return { ...runtime, textSealed: true };
		case "tool-started": {
			const parts = runtime.parts.slice();
			const toolPart: AssistantPart = {
				id: `tool:${event.callId}`,
				kind: "tool",
				tool: { callId: event.callId, input: event.input, status: "running", tool: event.tool },
			};
			const existing = parts.findIndex(
				(part) => part.kind === "tool" && part.tool.callId === event.callId,
			);

			if (existing >= 0) {
				parts[existing] = toolPart;
			} else {
				parts.push(toolPart);
			}

			return {
				...runtime,
				activity: { ...runtime.activity, streaming: true },
				parts,
				textSealed: true,
			};
		}
		case "tool-completed": {
			let matched = false;
			const parts = runtime.parts.map((part) => {
				if (part.kind !== "tool" || part.tool.callId !== event.callId) {
					return part;
				}

				matched = true;
				return {
					...part,
					tool: {
						...part.tool,
						errorText: event.errorText ?? part.tool.errorText,
						output: event.output ?? part.tool.output,
						outputTruncated: event.outputTruncated ?? part.tool.outputTruncated,
						status: event.status,
						tool: event.tool ?? part.tool.tool,
					},
				};
			});

			if (!matched && event.tool) {
				parts.push({
					id: `tool:${event.callId}`,
					kind: "tool",
					tool: {
						callId: event.callId,
						errorText: event.errorText,
						output: event.output,
						outputTruncated: event.outputTruncated,
						status: event.status,
						tool: event.tool,
					},
				});
			}

			return { ...runtime, parts };
		}
		case "input-request": {
			const parts = runtime.parts.slice();
			const part: AssistantPart = {
				id: `input:${event.requestId}`,
				inputSchema: event.inputSchema,
				kind: "input-request",
				prompt: event.prompt,
			};
			// input.requested carries no event index, so replays re-deliver it —
			// upsert by request id instead of blindly appending.
			const existing = parts.findIndex((candidate) => candidate.id === part.id);

			if (existing >= 0) {
				parts[existing] = part;
			} else {
				parts.push(part);
			}

			return { ...runtime, activity: { ...runtime.activity, streaming: true }, parts };
		}
		case "summary":
			return { ...runtime, activity: { ...runtime.activity, summary: event.phrase } };
		case "streaming":
			return {
				...runtime,
				activity: {
					streaming: event.streaming,
					summary: event.streaming ? runtime.activity.summary : null,
				},
			};
		case "seed-text": {
			if (event.content.length === 0 || runtime.parts.some((part) => part.kind === "text")) {
				return runtime;
			}

			return {
				...runtime,
				parts: [
					...runtime.parts,
					{
						id: `${event.messageId}:${runtime.parts.length}`,
						kind: "text",
						source: "message",
						text: event.content,
					},
				],
			};
		}
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
}

type TurnEvent =
	| { delta: string; kind: "text"; messageId: string }
	| { kind: "text-completed" }
	| { callId: string; input?: Record<string, unknown>; kind: "tool-started"; tool: string }
	| {
			callId: string;
			errorText?: string;
			kind: "tool-completed";
			output?: Record<string, unknown>;
			outputTruncated?: boolean;
			status: "completed" | "error" | "pending";
			tool?: string;
	  }
	| {
			inputSchema: Record<string, unknown> | null;
			kind: "input-request";
			prompt: string;
			requestId: string;
	  }
	| { kind: "summary"; phrase: string }
	| { kind: "streaming"; streaming: boolean }
	| { content: string; kind: "seed-text"; messageId: string };

function buildTurnRuntime(records: StreamEventRecord[]): Record<string, TurnRuntime> {
	const runtimes: Record<string, TurnRuntime> = {};

	for (const { event } of sortRecords(records)) {
		// A terminal error carries no turnId — it ends whichever turns are still
		// live, so their activity lines stop (mirrors mobile's run.failed fold).
		if (event.type === "error") {
			for (const [id, runtime] of Object.entries(runtimes)) {
				if (runtime.activity.streaming) {
					runtimes[id] = applyTurnEvent(runtime, { kind: "streaming", streaming: false });
				}
			}
			continue;
		}

		const turnId = "turnId" in event && typeof event.turnId === "string" ? event.turnId : null;

		if (!turnId) {
			continue;
		}

		const current = runtimes[turnId] ?? emptyTurnRuntime(true);

		if (event.type === "message.delta") {
			runtimes[turnId] = applyTurnEvent(current, {
				delta: event.delta,
				kind: "text",
				messageId: event.messageId,
			});
			continue;
		}

		if (event.type === "message.text.completed") {
			runtimes[turnId] = applyTurnEvent(current, { kind: "text-completed" });
			continue;
		}

		if (event.type === "message.completed") {
			runtimes[turnId] = applyTurnEvent(current, {
				content: event.message.content,
				kind: "seed-text",
				messageId: event.message.id,
			});
			continue;
		}

		if (event.type === "tool.started") {
			runtimes[turnId] = applyTurnEvent(current, {
				callId: event.toolCallId,
				input: event.input,
				kind: "tool-started",
				tool: event.toolName,
			});
			continue;
		}

		if (event.type === "tool.completed") {
			const output = event.output;
			const pendingApproval = event.status === "failed" && isPendingApprovalOutput(output);
			runtimes[turnId] = applyTurnEvent(current, {
				callId: event.toolCallId,
				errorText:
					event.status === "failed" && !pendingApproval ? toolErrorText(output) : undefined,
				kind: "tool-completed",
				output,
				outputTruncated: event.outputTruncated,
				status: pendingApproval ? "pending" : event.status === "failed" ? "error" : "completed",
				tool: event.toolName,
			});
			continue;
		}

		if (event.type === "reasoning.summary") {
			runtimes[turnId] = applyTurnEvent(current, { kind: "summary", phrase: event.phrase });
			continue;
		}

		if (event.type === "input.requested") {
			runtimes[turnId] = applyTurnEvent(current, {
				inputSchema: event.inputSchema,
				kind: "input-request",
				prompt: event.prompt,
				requestId: event.requestId,
			});
			continue;
		}

		if (event.type === "session.completed") {
			// Every terminal status ends the turn's activity — a failed run must
			// not keep the "thinking" line shimmering.
			runtimes[turnId] = applyTurnEvent(current, { kind: "streaming", streaming: false });
		}
	}

	return runtimes;
}

function buildTurnsFromMessages(
	messages: ThreadMessage[],
	runtimeByTurn: Record<string, TurnRuntime>,
): TranscriptTurn[] {
	const turns: TranscriptTurn[] = [];
	const byUserId = new Map<string, TranscriptTurn>();
	const byTurnId = new Map<string, TranscriptTurn>();

	for (const message of sortThreadMessages(messages)) {
		if (message.role === "user") {
			const turn = emptyTranscriptTurn(message.turnId);
			turn.userMessage = message;
			turns.push(turn);
			byUserId.set(message.id, turn);
			byTurnId.set(message.turnId, turn);
			continue;
		}

		if (message.role === "assistant") {
			const parentTurn =
				(message.parentMessageId ? byUserId.get(message.parentMessageId) : undefined) ??
				byTurnId.get(message.turnId);

			if (parentTurn) {
				parentTurn.assistantMessages.push(message);
				continue;
			}
		}

		const looseTurn = byTurnId.get(message.turnId) ?? emptyTranscriptTurn(message.turnId);

		if (!byTurnId.has(message.turnId)) {
			turns.push(looseTurn);
			byTurnId.set(message.turnId, looseTurn);
		}

		if (message.role === "assistant") {
			looseTurn.assistantMessages.push(message);
		} else {
			looseTurn.looseMessages.push(message);
		}
	}

	for (const turn of turns) {
		const runtime = runtimeByTurn[turn.id];

		turn.parts = runtime?.parts.length ? runtime.parts : partsFromMessages(turn.assistantMessages);
		turn.activity = runtime?.activity ?? activityFromMessages(turn.assistantMessages);
		turn.visibleTextStreaming = runtime
			? isRuntimeVisibleTextStreaming(runtime)
			: messagesHaveVisibleStreamingText(turn.assistantMessages);
	}

	return turns;
}

function emptyTranscriptTurn(id: string): TranscriptTurn {
	return {
		activity: IDLE_ACTIVITY,
		assistantMessages: [],
		id,
		looseMessages: [],
		parts: [],
		userMessage: null,
		visibleTextStreaming: false,
	};
}

function activityFromMessages(messages: ThreadMessage[]): TurnActivity {
	return messages.some((message) => message.status === "streaming")
		? { streaming: true, summary: null }
		: IDLE_ACTIVITY;
}

function isRuntimeVisibleTextStreaming(runtime: TurnRuntime): boolean {
	const last = runtime.parts[runtime.parts.length - 1];
	return (
		runtime.activity.streaming &&
		!runtime.textSealed &&
		last?.kind === "text" &&
		last.text.length > 0
	);
}

function messagesHaveVisibleStreamingText(messages: ThreadMessage[]): boolean {
	return messages.some(
		(message) =>
			message.role === "assistant" && message.status === "streaming" && message.content.length > 0,
	);
}

/** Upsert-by-id merge of durable thread messages (mirrors mobile chat-turns). */
export function mergeThreadMessages(
	current: ThreadMessage[],
	incoming: ThreadMessage[],
): ThreadMessage[] {
	const byId = new Map<string, ThreadMessage>();

	for (const message of current) {
		byId.set(message.id, message);
	}

	for (const message of incoming) {
		byId.set(message.id, message);
	}

	return sortThreadMessages([...byId.values()]);
}

function partsFromMessages(messages: ThreadMessage[]): AssistantPart[] {
	return messages
		.filter((message) => message.content.length > 0)
		.map((message) => ({
			id: message.id,
			kind: "text" as const,
			source: "message" as const,
			text: message.content,
		}));
}

function sortThreadMessages(messages: ThreadMessage[]): ThreadMessage[] {
	return [...messages].sort((left, right) => {
		const bySequence = left.messageSeq - right.messageSeq;

		if (bySequence !== 0) {
			return bySequence;
		}

		return left.id.localeCompare(right.id);
	});
}

function sortRecords(records: StreamEventRecord[]): StreamEventRecord[] {
	return [...records].sort((left, right) => {
		const leftIndex = eventIndex(left);
		const rightIndex = eventIndex(right);

		if (leftIndex !== rightIndex) {
			return leftIndex - rightIndex;
		}

		return left.receivedAt.localeCompare(right.receivedAt);
	});
}

function eventIndex(record: StreamEventRecord): number {
	return "index" in record.event && typeof record.event.index === "number"
		? record.event.index
		: Number.MAX_SAFE_INTEGER;
}

function toolErrorText(output: Record<string, unknown> | undefined): string | undefined {
	const message = stringValue(output, "message") ?? stringValue(output, "error");
	return message ?? (output ? formatDisplayValue(output) : undefined);
}

function humanizeToolName(name: string): string {
	const spaced = name.replace(/[._-]+/g, " ").trim();
	return spaced.length > 0 ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "tool";
}

const TOOL_PRESENTATIONS: Record<string, ToolPresentation> = {
	"artifact.appendTableRows": {
		defaultOpen: false,
		icon: "file",
		label: "Appended ledger rows",
	},
	"artifact.create": {
		defaultOpen: true,
		icon: "file",
		label: "Created artifact",
	},
	"artifact.update": {
		defaultOpen: false,
		icon: "file",
		label: "Updated artifact",
	},
	"brain.search": {
		defaultOpen: false,
		icon: "search",
		label: "Searched brain",
	},
	"connector.google.calendar.createEvent": {
		defaultOpen: false,
		icon: "calendar",
		label: "Created calendar event",
	},
	"connector.google.calendar.updateEvent": {
		defaultOpen: false,
		icon: "calendar",
		label: "Updated calendar event",
	},
	"connector.google.calendar.deleteEvent": {
		defaultOpen: false,
		icon: "calendar",
		label: "Deleted calendar event",
	},
	"connector.google.calendar.freeBusy": {
		defaultOpen: false,
		icon: "calendar",
		label: "Checked availability",
	},
	"connector.google.calendar.getEvent": {
		defaultOpen: false,
		icon: "calendar",
		label: "Read calendar event",
	},
	"connector.google.calendar.listEvents": {
		defaultOpen: false,
		icon: "calendar",
		label: "Listed calendar events",
	},
	"connector.google.gmail.addLabel": {
		defaultOpen: false,
		icon: "tag",
		label: "Added Gmail label",
	},
	"connector.google.gmail.createDraft": {
		defaultOpen: true,
		icon: "mail",
		label: "Created Gmail draft",
	},
	"connector.google.gmail.getMessage": {
		defaultOpen: false,
		icon: "mail",
		label: "Read email",
	},
	"connector.google.gmail.listLabels": {
		defaultOpen: false,
		icon: "tag",
		label: "Listed Gmail labels",
	},
	"connector.google.gmail.removeLabel": {
		defaultOpen: false,
		icon: "tag",
		label: "Removed Gmail label",
	},
	"connector.google.gmail.searchMessages": {
		defaultOpen: false,
		icon: "search",
		label: "Searched Gmail",
	},
	"connector.google.people.search": {
		defaultOpen: false,
		icon: "people",
		label: "Searched contacts",
	},
	"email.draft.create": {
		defaultOpen: true,
		icon: "mail",
		label: "Drafted email",
	},
	"email.draft.update": {
		defaultOpen: true,
		icon: "mail",
		label: "Updated draft",
	},
	"notification.get": {
		defaultOpen: false,
		icon: "bell",
		label: "Read notification",
	},
	load_toolset: {
		defaultOpen: false,
		icon: "tool",
		label: "Loaded toolset",
	},
	"web.extract": {
		defaultOpen: false,
		icon: "globe",
		label: "Read web source",
	},
	"web.search": {
		defaultOpen: false,
		icon: "search",
		label: "Searched web",
	},
};
