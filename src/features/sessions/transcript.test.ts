// The turn folding itself is covered by src/lib/session-transcript.test.ts and
// the shared golden wire fixtures (src/lib/wire-fixtures.test.ts). This file
// pins the view-level terminal-notice mapping.
import { describe, expect, it } from "bun:test";
import { threadMessageStreamEventSchema } from "@unison/contracts";

import { noticeFromStreamEvent } from "./transcript";

const THREAD_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const TURN_ID = "00000000-0000-4000-8000-000000000003";

function sessionCompleted(status: "cancelled" | "completed" | "failed") {
	return threadMessageStreamEventSchema.parse({
		index: 9,
		sessionId: SESSION_ID,
		status,
		threadId: THREAD_ID,
		turnId: TURN_ID,
		type: "session.completed",
	});
}

describe("noticeFromStreamEvent", () => {
	it("maps terminal statuses to notices and clears on clean completion", () => {
		expect(noticeFromStreamEvent(sessionCompleted("failed"))).toEqual({ kind: "failed" });
		expect(noticeFromStreamEvent(sessionCompleted("cancelled"))).toEqual({ kind: "cancelled" });
		expect(noticeFromStreamEvent(sessionCompleted("completed"))).toBeNull();
	});

	it("surfaces stream errors with their message", () => {
		const errorEvent = threadMessageStreamEventSchema.parse({
			code: "internal_error",
			message: "The model provider timed out.",
			sessionId: SESSION_ID,
			type: "error",
		});

		expect(noticeFromStreamEvent(errorEvent)).toEqual({
			kind: "error",
			message: "The model provider timed out.",
		});
	});

	it("returns null for non-terminal events", () => {
		const delta = threadMessageStreamEventSchema.parse({
			delta: "Hi",
			index: 0,
			messageId: "00000000-0000-4000-8000-000000000004",
			sessionId: SESSION_ID,
			threadId: THREAD_ID,
			turnId: TURN_ID,
			type: "message.delta",
		});

		expect(noticeFromStreamEvent(delta)).toBeNull();
	});
});
