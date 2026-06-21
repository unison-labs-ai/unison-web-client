// catalog: CLI-006, CLI-007
import { describe, expect, test } from "bun:test";

import { threadMessageStreamEventSchema } from "@unison/contracts";
import {
	WIRE_STREAM_NAMES,
	type WireExpectedProjection,
	type WireStreamEvent,
	wireExpectedProjection,
	wireSseText,
	wireStreamFixture,
} from "@unison/testkit/fixtures/wire";
import { buildTranscriptTurns, type TranscriptTurn } from "./session-transcript";
import { emitSseBlocks } from "./sse";
import {
	getLatestEventIndex,
	isTerminalStreamEvent,
	mergeStreamEventRecord,
	type StreamEventRecord,
} from "./stream-events";

/**
 * The shared golden wire fixtures driven through the web SSE decoder and
 * transcript reducer (CLI-006): the SAME committed files the mobile suite and
 * the API suite consume. Parser drift between clients fails here or there —
 * never silently.
 */

function decodeSse(name: (typeof WIRE_STREAM_NAMES)[number]) {
	const events: Array<ReturnType<typeof threadMessageStreamEventSchema.parse>> = [];
	const rest = emitSseBlocks(
		wireSseText(name),
		(event) => events.push(event),
		threadMessageStreamEventSchema,
	);

	return { events, rest };
}

function toRecords(events: WireStreamEvent[]): StreamEventRecord[] {
	return events
		.filter((event) => threadMessageStreamEventSchema.safeParse(event).success)
		.reduce<StreamEventRecord[]>(
			(records, event, position) =>
				mergeStreamEventRecord(records, {
					event: threadMessageStreamEventSchema.parse(event),
					receivedAt: `2026-06-11T08:00:0${position}.000Z`,
				}),
			[],
		);
}

function project(turn: TranscriptTurn): WireExpectedProjection["parts"] {
	// The cross-client projection covers the shared part vocabulary (text +
	// tool). Web-only kinds (input-request) are asserted separately.
	return turn.parts.flatMap((part): WireExpectedProjection["parts"] => {
		if (part.kind === "text") {
			return [{ kind: "text", text: part.text }];
		}

		if (part.kind === "tool") {
			return [
				{
					kind: "tool",
					output: part.tool.output ?? {},
					status: part.tool.status,
					tool: part.tool.tool,
				},
			];
		}

		return [];
	});
}

describe("shared wire fixtures through the web decoder and reducer (CLI-006)", () => {
	test("the SSE bytes decode to exactly the fixture events (wire agreement)", () => {
		const { events } = decodeSse("full-turn");

		expect(events).toEqual(
			wireStreamFixture("full-turn").map((event) => threadMessageStreamEventSchema.parse(event)),
		);
	});

	test("the full turn renders the shared expected projection", () => {
		const expected = wireExpectedProjection("full-turn");
		const records = toRecords(wireStreamFixture("full-turn"));
		const turns = buildTranscriptTurns([], records);

		expect(turns).toHaveLength(1);

		const turn = turns[0];

		if (!turn) {
			throw new Error("expected one transcript turn");
		}

		expect(project(turn)).toEqual(expected.parts);

		// The reasoning phrase showed during the turn and vanished at completion.
		const beforeTerminal = buildTranscriptTurns(
			[],
			toRecords(
				wireStreamFixture("full-turn").filter((event) => event.type !== "session.completed"),
			),
		);

		expect(beforeTerminal[0]?.activity.summary).toBe(expected.summaryPhraseDuringTurn);
		expect(turn.activity).toEqual({ streaming: false, summary: null });
	});

	test("the failed turn ends on the error terminal with partial text intact", () => {
		const events = wireStreamFixture("failed-turn");
		const parsed = events.map((event) => threadMessageStreamEventSchema.parse(event));
		const terminal = parsed.at(-1);

		if (!terminal) {
			throw new Error("fixture must have events");
		}

		expect(isTerminalStreamEvent(terminal)).toBe(true);

		const turns = buildTranscriptTurns([], toRecords(events));

		expect(turns[0] ? project(turns[0]) : []).toEqual([{ kind: "text", text: "Let me check" }]);
	});

	test("unknown kinds are skipped by the schema decoder; known kinds still land (forward compatibility)", () => {
		const { events } = decodeSse("forward-compat");
		const kinds = events.map((event) => event.type);

		// future.unknown.kind is dropped (schema-tolerant), input.requested and
		// the rest parse.
		expect(kinds).toEqual(["message.delta", "input.requested", "session.completed"]);

		const turns = buildTranscriptTurns([], toRecords(wireStreamFixture("forward-compat")));

		expect(turns[0] ? project(turns[0]) : []).toEqual([{ kind: "text", text: "Working on it." }]);
		// Web is ahead of mobile here: input.requested already renders as an
		// input-request part (mobile ignores the kind until the surface lands).
		expect(turns[0]?.parts.some((part) => part.kind === "input-request")).toBe(true);
	});
});

describe("reducer determinism and cursor handling (CLI-007)", () => {
	test("replaying the same log twice yields an identical transcript model", () => {
		for (const name of WIRE_STREAM_NAMES) {
			const first = buildTranscriptTurns([], toRecords(wireStreamFixture(name)));
			const second = buildTranscriptTurns([], toRecords(wireStreamFixture(name)));

			expect(JSON.stringify(second)).toBe(JSON.stringify(first));
		}
	});

	test("out-of-order and duplicate delivery converge to the same ordered model", () => {
		const events = wireStreamFixture("full-turn");
		const shuffled = [...events.slice(4), ...events.slice(0, 4), ...events.slice(2, 6)];
		const ordered = buildTranscriptTurns([], toRecords(events));
		const reordered = buildTranscriptTurns([], toRecords(shuffled));

		expect(JSON.stringify(reordered)).toBe(JSON.stringify(ordered));
	});

	test("the reconnect cursor is the highest seen index", () => {
		const records = toRecords(wireStreamFixture("full-turn"));

		expect(getLatestEventIndex(records)).toBe(7);
	});
});
