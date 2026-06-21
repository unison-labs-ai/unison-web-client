// catalog: CLI-005
import { describe, expect, it } from "bun:test";
import type { ThreadMessageStreamEvent } from "@unison/contracts";

import {
	getLatestEventIndex,
	isTerminalStreamEvent,
	mergeStreamEventRecord,
} from "./stream-events";

const delta = (index: number): ThreadMessageStreamEvent => ({
	delta: "hello",
	index,
	messageId: "00000000-0000-4000-8000-000000000001",
	sessionId: "00000000-0000-4000-8000-000000000002",
	threadId: "00000000-0000-4000-8000-000000000003",
	turnId: "00000000-0000-4000-8000-000000000004",
	type: "message.delta",
});

describe("stream event cursor helpers", () => {
	it("dedupes replayed event indexes", () => {
		const first = { event: delta(2), receivedAt: "2026-06-09T10:00:00.000Z" };
		const replayed = { event: delta(2), receivedAt: "2026-06-09T10:00:01.000Z" };

		expect(mergeStreamEventRecord([first], replayed)).toEqual([first]);
	});

	it("keeps same-index events from different runs (indexes restart per turn)", () => {
		const firstTurn = { event: delta(2), receivedAt: "2026-06-09T10:00:00.000Z" };
		const secondTurn = {
			event: {
				...delta(2),
				sessionId: "00000000-0000-4000-8000-000000000005",
				turnId: "00000000-0000-4000-8000-000000000006",
			},
			receivedAt: "2026-06-09T10:00:01.000Z",
		};

		expect(mergeStreamEventRecord([firstTurn], secondTurn)).toHaveLength(2);
	});

	it("tracks the highest replay cursor", () => {
		expect(
			getLatestEventIndex([
				{ event: delta(1), receivedAt: "2026-06-09T10:00:00.000Z" },
				{ event: delta(7), receivedAt: "2026-06-09T10:00:01.000Z" },
			]),
		).toBe(7);
	});

	it("recognizes terminal stream events", () => {
		expect(
			isTerminalStreamEvent({
				index: 8,
				sessionId: "00000000-0000-4000-8000-000000000002",
				status: "completed",
				threadId: "00000000-0000-4000-8000-000000000003",
				turnId: "00000000-0000-4000-8000-000000000004",
				type: "session.completed",
			}),
		).toBe(true);
	});
});
