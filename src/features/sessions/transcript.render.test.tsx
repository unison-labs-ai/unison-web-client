// Render smoke for the turn-model transcript: real wire events folded by the
// shared lib, server-rendered to markup. Pins the mobile-parity behaviors the
// session view promises — streamed text segments interleave around tool cards,
// tool cards stay visible, and the reasoning snippet shows only while the
// agent is NOT streaming user-facing text.
import { describe, expect, it } from "bun:test";
import type { ThreadMessage, ThreadMessageStreamEvent } from "@unison/contracts";
import { threadMessageFixture } from "@unison/testkit/fixtures";
import { renderToStaticMarkup } from "react-dom/server";

import { buildTranscriptTurns } from "@/lib/session-transcript";
import type { StreamEventRecord } from "@/lib/stream-events";
import { Transcript } from "./transcript";

const THREAD_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const TURN_ID = "00000000-0000-4000-8000-000000000003";
const USER_MESSAGE_ID = "00000000-0000-4000-8000-000000000004";
const ASSISTANT_MESSAGE_ID = "00000000-0000-4000-8000-000000000005";
const TOOL_CALL_ID = "00000000-0000-4000-8000-000000000006";

function userMessage(): ThreadMessage {
	return threadMessageFixture<ThreadMessage>({
		content: "What is on my calendar?",
		createdAt: "2026-06-11T10:00:00.000Z",
		id: USER_MESSAGE_ID,
		messageSeq: 1,
		role: "user",
		sessionId: SESSION_ID,
		threadId: THREAD_ID,
		turnId: TURN_ID,
		updatedAt: "2026-06-11T10:00:00.000Z",
	});
}

function record(event: ThreadMessageStreamEvent): StreamEventRecord {
	return { event, receivedAt: "2026-06-11T10:00:00.000Z" };
}

function delta(index: number, text: string): StreamEventRecord {
	return record({
		delta: text,
		index,
		messageId: ASSISTANT_MESSAGE_ID,
		sessionId: SESSION_ID,
		threadId: THREAD_ID,
		turnId: TURN_ID,
		type: "message.delta",
	});
}

describe("Transcript render (turn model)", () => {
	it("renders streamed text around a tool card and hides the snippet mid-text", () => {
		const records = [
			record({
				index: 0,
				phrase: "Checking the calendar",
				sessionId: SESSION_ID,
				turnId: TURN_ID,
				type: "reasoning.summary",
			}),
			delta(1, "Let me check."),
			record({
				index: 2,
				input: { calendarId: "primary" },
				sessionId: SESSION_ID,
				toolCallId: TOOL_CALL_ID,
				toolName: "connector.google.calendar.listEvents",
				turnId: TURN_ID,
				type: "tool.started",
			}),
			record({
				index: 3,
				output: { events: [{ title: "Design review" }] },
				sessionId: SESSION_ID,
				status: "completed",
				toolCallId: TOOL_CALL_ID,
				toolName: "connector.google.calendar.listEvents",
				turnId: TURN_ID,
				type: "tool.completed",
			}),
			delta(4, " You are free at 3."),
		];

		const turns = buildTranscriptTurns([userMessage()], records);
		const markup = renderToStaticMarkup(<Transcript turns={turns} />);

		// User bubble + both text segments + the collapsed tool group, in order.
		// The group is not the turn's last block (text follows), so it renders as
		// just its per-toolset header; the row label only appears on expand.
		expect(markup).toContain("What is on my calendar?");
		const firstText = markup.indexOf("Let me check.");
		const groupHeader = markup.indexOf("Used Calendar integration");
		const secondText = markup.indexOf("You are free at 3.");
		expect(firstText).toBeGreaterThan(-1);
		expect(groupHeader).toBeGreaterThan(firstText);
		expect(secondText).toBeGreaterThan(groupHeader);
		// Collapsed group: the individual row label is not rendered yet.
		expect(markup).not.toContain("Checked your calendar");

		// Visible text is streaming — the reasoning snippet must NOT render.
		expect(markup).not.toContain("Checking the calendar");
	});

	it("shows recent tool rows while a tool group is the live streaming block", () => {
		const records = [
			record({
				index: 0,
				input: { query: "unison" },
				sessionId: SESSION_ID,
				toolCallId: TOOL_CALL_ID,
				toolName: "connector.google.gmail.searchMessages",
				turnId: TURN_ID,
				type: "tool.started",
			}),
		];

		const turns = buildTranscriptTurns([userMessage()], records);
		const markup = renderToStaticMarkup(<Transcript turns={turns} />);

		// Live last group: the per-toolset header AND the most-recent row label.
		expect(markup).toContain("Used Gmail integration");
		expect(markup).toContain("Searched Gmail");
	});

	it("shows the latest reasoning snippet while no visible text is streaming", () => {
		const records = [
			record({
				index: 0,
				phrase: "Reading the inbox",
				sessionId: SESSION_ID,
				turnId: TURN_ID,
				type: "reasoning.summary",
			}),
		];

		const turns = buildTranscriptTurns([userMessage()], records);
		const markup = renderToStaticMarkup(<Transcript turns={turns} />);

		expect(markup).toContain("Reading the inbox");
	});

	it("keeps the tool group and drops the activity line once the turn completes", () => {
		const records = [
			record({
				index: 0,
				input: { query: "unison" },
				sessionId: SESSION_ID,
				toolCallId: TOOL_CALL_ID,
				toolName: "web.search",
				turnId: TURN_ID,
				type: "tool.started",
			}),
			record({
				index: 1,
				output: { results: [{ title: "Unison", url: "https://unison.dev" }] },
				sessionId: SESSION_ID,
				status: "completed",
				toolCallId: TOOL_CALL_ID,
				toolName: "web.search",
				turnId: TURN_ID,
				type: "tool.completed",
			}),
			delta(2, "Found it."),
			record({
				index: 3,
				sessionId: SESSION_ID,
				status: "completed",
				threadId: THREAD_ID,
				turnId: TURN_ID,
				type: "session.completed",
			}),
		];

		const turns = buildTranscriptTurns([userMessage()], records);
		const markup = renderToStaticMarkup(<Transcript turns={turns} />);

		// Completed turn: the tool group persists but collapses to its header.
		expect(markup).toContain("Searched the web");
		expect(markup).toContain("Found it.");
		expect(markup).not.toContain("Thinking");
	});

	it("renders a combined per-toolset header for a multi-toolset group", () => {
		const SECOND_CALL = "00000000-0000-4000-8000-000000000007";
		const records = [
			record({
				index: 0,
				input: { query: "x" },
				sessionId: SESSION_ID,
				toolCallId: TOOL_CALL_ID,
				toolName: "connector.google.gmail.searchMessages",
				turnId: TURN_ID,
				type: "tool.started",
			}),
			record({
				index: 1,
				output: { messages: [] },
				sessionId: SESSION_ID,
				status: "completed",
				toolCallId: TOOL_CALL_ID,
				toolName: "connector.google.gmail.searchMessages",
				turnId: TURN_ID,
				type: "tool.completed",
			}),
			record({
				index: 2,
				input: {},
				sessionId: SESSION_ID,
				toolCallId: SECOND_CALL,
				toolName: "load_toolset",
				turnId: TURN_ID,
				type: "tool.started",
			}),
			record({
				index: 3,
				output: {},
				sessionId: SESSION_ID,
				status: "completed",
				toolCallId: SECOND_CALL,
				toolName: "load_toolset",
				turnId: TURN_ID,
				type: "tool.completed",
			}),
			delta(4, "Done."),
			record({
				index: 5,
				sessionId: SESSION_ID,
				status: "completed",
				threadId: THREAD_ID,
				turnId: TURN_ID,
				type: "session.completed",
			}),
		];

		const turns = buildTranscriptTurns([userMessage()], records);
		const markup = renderToStaticMarkup(<Transcript turns={turns} />);

		expect(markup).toContain("Used Gmail integration, loaded tools");
	});
});
