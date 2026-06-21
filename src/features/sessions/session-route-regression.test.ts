// catalog: CLI-008
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function readNeighbor(path: string): string {
	return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("web session route regression guards", () => {
	test("session view uses global app events instead of owning a per-turn stream", () => {
		const view = readNeighbor("./session-view.tsx");

		expect(view).toContain("useAppEvents");
		expect(view).not.toContain("useThreadStream");
		expect(view).not.toContain("Live updates interrupted");
	});

	test("session view handles admission and message-created app events", () => {
		const view = readNeighbor("./session-view.tsx");

		expect(view).toContain('event.type === "turn.admitted" || event.type === "run.started"');
		expect(view).toContain('event.type === "message.created"');
		expect(view).toContain("threadMessageSchema.safeParse");
	});

	test("queued ghosts stay muted and do not show a sending status", () => {
		const composer = readNeighbor("./session-composer.tsx");

		expect(composer).toContain("queuedMessages");
		expect(composer).toContain("queueSendingRef");
		expect(composer).toContain("isQueuedMessageLocked");
		expect(composer).not.toContain("queueFlushTokenRef");
		expect(composer).not.toContain("retryScheduled");
		expect(composer).not.toContain("waitingForLiveTurnRef");
		expect(composer).not.toContain("Sending...");
	});
});
