import { describe, expect, test } from "bun:test";

import {
	type AppliedTranscriptEvent,
	applyTranscriptEvent,
	createRealtimeTranscriptState,
	transcriptWithPartial,
} from "./transcript-state";

function committed(
	text: string,
	options: { endMs?: number | null; hasTimestamps?: boolean; startMs?: number | null } = {},
): AppliedTranscriptEvent {
	const hasTimestamps = options.hasTimestamps ?? true;

	return {
		endMs: hasTimestamps ? (options.endMs ?? 1000) : null,
		hasTimestamps,
		kind: "committed",
		languageCode: "en",
		source: "elevenlabs_realtime",
		startMs: hasTimestamps ? (options.startMs ?? 0) : null,
		text,
	};
}

describe("applyTranscriptEvent", () => {
	test("a final supersedes the live partial", () => {
		let state = createRealtimeTranscriptState();

		state = applyTranscriptEvent(state, { kind: "partial", text: "hello wor" });
		expect(state.partial).toBe("hello wor");

		state = applyTranscriptEvent(state, committed("hello world"));
		expect(state.partial).toBe("");
		expect(state.segments).toHaveLength(1);
		expect(state.committedText).toBe("hello world");
	});

	test("a stale partial echoing the last segment is cleared", () => {
		let state = createRealtimeTranscriptState();

		state = applyTranscriptEvent(state, committed("done already"));
		state = applyTranscriptEvent(state, { kind: "partial", text: "done  already" });

		expect(state.partial).toBe("");
	});

	test("dual committed messages upgrade the segment in place", () => {
		let state = createRealtimeTranscriptState();

		state = applyTranscriptEvent(state, committed("hello world", { hasTimestamps: false }));
		expect(state.segments[0]?.startMs).toBeUndefined();

		state = applyTranscriptEvent(state, committed("hello world", { endMs: 1400, startMs: 200 }));
		expect(state.segments).toHaveLength(1);
		expect(state.segments[0]).toMatchObject({ endMs: 1400, startMs: 200 });
		expect(state.segments[0]?.metadata.timestampsUpgraded).toBe(true);
		expect(state.committedText).toBe("hello world");
	});

	test("replay duplicates at near-identical timing are skipped", () => {
		let state = createRealtimeTranscriptState();

		state = applyTranscriptEvent(
			state,
			committed("rewind overlap", { endMs: 5000, startMs: 4000 }),
		);
		state = applyTranscriptEvent(
			state,
			committed("rewind overlap", { endMs: 5400, startMs: 4300 }),
		);

		expect(state.segments).toHaveLength(1);
		expect(state.committedText).toBe("rewind overlap");
	});

	test("a legitimately repeated phrase at distinct timing appends", () => {
		let state = createRealtimeTranscriptState();

		state = applyTranscriptEvent(state, committed("yes.", { endMs: 1000, startMs: 500 }));
		state = applyTranscriptEvent(state, committed("yes.", { endMs: 9000, startMs: 8500 }));

		expect(state.segments).toHaveLength(2);
		expect(state.committedText).toBe("yes. yes.");
	});

	test("committedText accumulates incrementally across segments", () => {
		let state = createRealtimeTranscriptState();

		state = applyTranscriptEvent(state, committed("first part", { endMs: 1000, startMs: 0 }));
		state = applyTranscriptEvent(state, committed("second part", { endMs: 3000, startMs: 2000 }));
		state = applyTranscriptEvent(state, { kind: "partial", text: "and a tail" });

		expect(state.committedText).toBe("first part second part");
		expect(transcriptWithPartial(state.committedText, state.partial)).toBe(
			"first part second part and a tail",
		);
		expect(state.segments.map((segment) => segment.index)).toEqual([0, 1]);
	});
});
