import type { ThreadMessageStreamEvent } from "@unison/contracts";

export type StreamEventRecord = {
	event: ThreadMessageStreamEvent;
	receivedAt: string;
};

export function getStreamEventIndex(event: ThreadMessageStreamEvent): number | null {
	return "index" in event ? event.index : null;
}

export function getLatestEventIndex(records: StreamEventRecord[]): number {
	return records.reduce((latest, record) => {
		const index = getStreamEventIndex(record.event);
		return index === null ? latest : Math.max(latest, index);
	}, -1);
}

export function isTerminalStreamEvent(event: ThreadMessageStreamEvent): boolean {
	return event.type === "session.completed" || event.type === "error";
}

function getStreamEventRunId(event: ThreadMessageStreamEvent): string | null {
	return "sessionId" in event && typeof event.sessionId === "string" ? event.sessionId : null;
}

export function mergeStreamEventRecord(
	records: StreamEventRecord[],
	record: StreamEventRecord,
): StreamEventRecord[] {
	const index = getStreamEventIndex(record.event);

	if (index !== null) {
		// Indexes are per-run (each turn restarts at 0), so the run id is part of
		// the dedupe key — otherwise a later turn's events would be dropped as
		// re-deliveries of the previous turn's.
		const runId = getStreamEventRunId(record.event);
		const duplicate = records.some((existing) => {
			const existingIndex = getStreamEventIndex(existing.event);
			return (
				existing.event.type === record.event.type &&
				existingIndex === index &&
				getStreamEventRunId(existing.event) === runId
			);
		});

		if (duplicate) {
			return records;
		}
	}

	return [...records, record].sort((left, right) => {
		const leftIndex = getStreamEventIndex(left.event);
		const rightIndex = getStreamEventIndex(right.event);

		if (leftIndex === null && rightIndex === null) {
			return left.receivedAt.localeCompare(right.receivedAt);
		}

		if (leftIndex === null) {
			return 1;
		}

		if (rightIndex === null) {
			return -1;
		}

		return leftIndex - rightIndex;
	});
}
