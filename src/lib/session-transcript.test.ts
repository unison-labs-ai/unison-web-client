// catalog: CLI-003
import { describe, expect, it } from "bun:test";
import type { ThreadMessage, ThreadMessageStreamEvent } from "@unison/contracts";
import { threadMessageFixture } from "@unison/testkit/fixtures";

import {
	buildTranscriptTurns,
	mergeThreadMessages,
	shouldShowActivitySummary,
	summarizeToolResult,
} from "./session-transcript";
import type { StreamEventRecord } from "./stream-events";

const THREAD_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const TURN_ID = "00000000-0000-4000-8000-000000000003";
const USER_MESSAGE_ID = "00000000-0000-4000-8000-000000000004";
const ASSISTANT_MESSAGE_ID = "00000000-0000-4000-8000-000000000005";
const TOOL_CALL_ID = "00000000-0000-4000-8000-000000000006";

function message(overrides: Partial<ThreadMessage>): ThreadMessage {
	return threadMessageFixture<ThreadMessage>({
		createdAt: "2026-06-09T10:00:00.000Z",
		id: USER_MESSAGE_ID,
		sessionId: SESSION_ID,
		threadId: THREAD_ID,
		turnId: TURN_ID,
		updatedAt: "2026-06-09T10:00:00.000Z",
		...overrides,
	});
}

function record(event: ThreadMessageStreamEvent): StreamEventRecord {
	return { event, receivedAt: "2026-06-09T10:00:00.000Z" };
}

function firstTurn(turns: ReturnType<typeof buildTranscriptTurns>) {
	const turn = turns[0];

	if (!turn) {
		throw new Error("Expected a transcript turn.");
	}

	return turn;
}

describe("session transcript folding", () => {
	it("orders streamed assistant text around tool calls and clears completed summaries", () => {
		const turns = buildTranscriptTurns(
			[
				message({
					content: "Check my calendar.",
					id: USER_MESSAGE_ID,
					messageSeq: 1,
					role: "user",
				}),
			],
			[
				record({
					delta: "I will check.",
					index: 0,
					messageId: ASSISTANT_MESSAGE_ID,
					sessionId: SESSION_ID,
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "message.delta",
				}),
				record({
					index: 1,
					input: { calendarId: "primary" },
					sessionId: SESSION_ID,
					toolCallId: TOOL_CALL_ID,
					toolName: "connector.google.calendar.listEvents",
					turnId: TURN_ID,
					type: "tool.started",
				}),
				record({
					index: 2,
					output: { events: [{ title: "Design review" }] },
					sessionId: SESSION_ID,
					status: "completed",
					toolCallId: TOOL_CALL_ID,
					toolName: "connector.google.calendar.listEvents",
					turnId: TURN_ID,
					type: "tool.completed",
				}),
				record({
					delta: " You are free at 3.",
					index: 3,
					messageId: ASSISTANT_MESSAGE_ID,
					sessionId: SESSION_ID,
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "message.delta",
				}),
				record({
					index: 4,
					phrase: "Checking calendar",
					sessionId: SESSION_ID,
					turnId: TURN_ID,
					type: "reasoning.summary",
				}),
				record({
					index: 5,
					sessionId: SESSION_ID,
					status: "completed",
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "session.completed",
				}),
			],
		);

		expect(turns).toHaveLength(1);
		const turn = firstTurn(turns);
		expect(turn.parts.map((part) => part.kind)).toEqual(["text", "tool", "text"]);
		expect(turn.parts[0]).toMatchObject({ kind: "text", text: "I will check." });
		expect(turn.parts[1]).toMatchObject({
			kind: "tool",
			tool: { status: "completed", tool: "connector.google.calendar.listEvents" },
		});
		expect(turn.parts[2]).toMatchObject({
			kind: "text",
			text: " You are free at 3.",
		});
		expect(turn.activity).toEqual({ streaming: false, summary: null });
		expect(shouldShowActivitySummary(turn)).toBe(false);
	});

	it("shows activity for a freshly streaming assistant message before text appears", () => {
		const turns = buildTranscriptTurns(
			[
				message({
					content: "Say hi.",
					id: USER_MESSAGE_ID,
					messageSeq: 1,
					role: "user",
				}),
				message({
					content: "",
					id: ASSISTANT_MESSAGE_ID,
					messageSeq: 2,
					parentMessageId: USER_MESSAGE_ID,
					role: "assistant",
					status: "streaming",
				}),
			],
			[],
		);

		expect(turns).toHaveLength(1);
		const turn = firstTurn(turns);
		expect(turn.activity).toEqual({ streaming: true, summary: null });
		expect(turn.visibleTextStreaming).toBe(false);
		expect(shouldShowActivitySummary(turn)).toBe(true);
	});

	it("shows the reasoning summary before visible text and hides it while text streams", () => {
		const thinkingOnly = buildTranscriptTurns(
			[
				message({
					content: "Plan this.",
					id: USER_MESSAGE_ID,
					messageSeq: 1,
					role: "user",
				}),
			],
			[
				record({
					index: 0,
					phrase: "Planning response",
					sessionId: SESSION_ID,
					turnId: TURN_ID,
					type: "reasoning.summary",
				}),
			],
		);

		const thinkingTurn = firstTurn(thinkingOnly);
		expect(thinkingTurn.activity).toEqual({
			streaming: true,
			summary: "Planning response",
		});
		expect(thinkingTurn.visibleTextStreaming).toBe(false);
		expect(shouldShowActivitySummary(thinkingTurn)).toBe(true);

		const visibleText = buildTranscriptTurns(
			[
				message({
					content: "Plan this.",
					id: USER_MESSAGE_ID,
					messageSeq: 1,
					role: "user",
				}),
			],
			[
				record({
					index: 0,
					phrase: "Planning response",
					sessionId: SESSION_ID,
					turnId: TURN_ID,
					type: "reasoning.summary",
				}),
				record({
					delta: "Here is the plan.",
					index: 1,
					messageId: ASSISTANT_MESSAGE_ID,
					sessionId: SESSION_ID,
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "message.delta",
				}),
			],
		);

		const visibleTurn = firstTurn(visibleText);
		expect(visibleTurn.visibleTextStreaming).toBe(true);
		expect(shouldShowActivitySummary(visibleTurn)).toBe(false);
	});

	it("re-shows the activity line after a tool call seals the text segment", () => {
		const turns = buildTranscriptTurns(
			[message({ content: "Check mail.", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" })],
			[
				record({
					delta: "Let me look.",
					index: 0,
					messageId: ASSISTANT_MESSAGE_ID,
					sessionId: SESSION_ID,
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "message.delta",
				}),
				record({
					index: 1,
					input: { query: "is:unread" },
					sessionId: SESSION_ID,
					toolCallId: TOOL_CALL_ID,
					toolName: "connector.google.gmail.searchMessages",
					turnId: TURN_ID,
					type: "tool.started",
				}),
			],
		);

		const turn = firstTurn(turns);
		expect(turn.visibleTextStreaming).toBe(false);
		expect(shouldShowActivitySummary(turn)).toBe(true);
	});

	it("renders approval-gated tools as pending instead of failed", () => {
		const turns = buildTranscriptTurns(
			[message({ content: "Do it.", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" })],
			[
				record({
					index: 0,
					input: { title: "Budget reminder" },
					sessionId: SESSION_ID,
					toolCallId: TOOL_CALL_ID,
					toolName: "reminder.create",
					turnId: TURN_ID,
					type: "tool.started",
				}),
				record({
					index: 1,
					output: {
						code: "needs_approval",
						error: "reminder.create is configured to ask for approval before execution.",
						retryable: true,
					},
					sessionId: SESSION_ID,
					status: "failed",
					toolCallId: TOOL_CALL_ID,
					toolName: "reminder.create",
					turnId: TURN_ID,
					type: "tool.completed",
				}),
			],
		);
		const tool = firstTurn(turns).parts.find((part) => part.kind === "tool");

		expect(tool).toMatchObject({
			kind: "tool",
			tool: { status: "pending", tool: "reminder.create" },
		});
		expect(tool?.kind === "tool" ? summarizeToolResult(tool.tool) : undefined).toBe(
			"Pending approval",
		);
	});

	it("ends activity on every terminal status, including failed", () => {
		const turns = buildTranscriptTurns(
			[message({ content: "Do it.", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" })],
			[
				record({
					delta: "Working",
					index: 0,
					messageId: ASSISTANT_MESSAGE_ID,
					sessionId: SESSION_ID,
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "message.delta",
				}),
				record({
					index: 1,
					sessionId: SESSION_ID,
					status: "failed",
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "session.completed",
				}),
			],
		);

		const turn = firstTurn(turns);
		expect(turn.activity).toEqual({ streaming: false, summary: null });
		expect(shouldShowActivitySummary(turn)).toBe(false);
	});

	it("ends live activity on a terminal error event (which carries no turnId)", () => {
		const turns = buildTranscriptTurns(
			[message({ content: "Go.", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" })],
			[
				record({
					delta: "Starting",
					index: 0,
					messageId: ASSISTANT_MESSAGE_ID,
					sessionId: SESSION_ID,
					threadId: THREAD_ID,
					turnId: TURN_ID,
					type: "message.delta",
				}),
				record({
					code: "internal_error",
					message: "Provider timed out.",
					sessionId: SESSION_ID,
					type: "error",
				}),
			],
		);

		const turn = firstTurn(turns);
		expect(turn.activity.streaming).toBe(false);
		expect(shouldShowActivitySummary(turn)).toBe(false);
	});

	it("upserts re-delivered input requests instead of duplicating them", () => {
		const REQUEST_ID = "00000000-0000-4000-8000-000000000007";
		const inputRequested = {
			inputSchema: null,
			prompt: "Which calendar?",
			requestId: REQUEST_ID,
			sessionId: SESSION_ID,
			turnId: TURN_ID,
			type: "input.requested",
		} as const;
		const turns = buildTranscriptTurns(
			[message({ content: "Book it.", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" })],
			[record(inputRequested), record(inputRequested)],
		);

		const turn = firstTurn(turns);
		expect(turn.parts.filter((part) => part.kind === "input-request")).toHaveLength(1);
	});

	it("merges thread messages by id and keeps messageSeq order", () => {
		const user = message({ content: "Hi", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" });
		const placeholder = message({
			content: "",
			id: ASSISTANT_MESSAGE_ID,
			messageSeq: 2,
			role: "assistant",
			status: "streaming",
		});
		const completed = message({
			content: "Hello!",
			id: ASSISTANT_MESSAGE_ID,
			messageSeq: 2,
			role: "assistant",
			status: "complete",
		});

		const merged = mergeThreadMessages([placeholder, user], [completed]);
		expect(merged.map((entry) => entry.id)).toEqual([USER_MESSAGE_ID, ASSISTANT_MESSAGE_ID]);
		expect(merged[1]?.content).toBe("Hello!");
	});

	it("merges snapshots without dropping a locally accepted newer turn", () => {
		const user = message({ content: "Hi", id: USER_MESSAGE_ID, messageSeq: 1, role: "user" });
		const assistant = message({
			content: "Hello!",
			id: ASSISTANT_MESSAGE_ID,
			messageSeq: 2,
			role: "assistant",
			status: "complete",
		});
		const queuedUser = message({
			content: "Follow up",
			id: "00000000-0000-4000-8000-000000000007",
			messageSeq: 3,
			role: "user",
			turnId: "00000000-0000-4000-8000-000000000009",
		});
		const queuedAssistant = message({
			content: "",
			id: "00000000-0000-4000-8000-000000000008",
			messageSeq: 4,
			role: "assistant",
			sessionId: "00000000-0000-4000-8000-000000000010",
			status: "streaming",
			turnId: "00000000-0000-4000-8000-000000000009",
		});

		const merged = mergeThreadMessages(
			[user, assistant, queuedUser, queuedAssistant],
			[user, assistant],
		);

		expect(merged.map((entry) => entry.id)).toEqual([
			USER_MESSAGE_ID,
			ASSISTANT_MESSAGE_ID,
			"00000000-0000-4000-8000-000000000007",
			"00000000-0000-4000-8000-000000000008",
		]);
	});
});
