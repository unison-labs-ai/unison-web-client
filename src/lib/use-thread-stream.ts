"use client";

import type { ThreadMessageStreamEvent } from "@unison/contracts";
import { useEffect, useRef } from "react";

import { useApi } from "@/lib/api-context";

type UseThreadStreamOptions = {
	enabled?: boolean;
	/** Called with false when a connect attempt fails, true while the stream is healthy. */
	onConnectionChange?: (connected: boolean) => void;
	onEvent: (event: ThreadMessageStreamEvent) => void;
	/** The agent-run (turn) id — NOT the thread id. The stream endpoint is per-turn. */
	sessionId: string | null;
	threadId: string;
};

const BASE_RETRY_MS = 1500;
const MAX_RETRY_MS = 12_000;

function isTerminal(event: ThreadMessageStreamEvent): boolean {
	return event.type === "session.completed" || event.type === "error";
}

/**
 * Replay+tail consumer for `GET /v1/threads/:threadId/stream?sessionId=&fromEventIndex=`.
 *
 * Server semantics (see services/api stream route + its conformance tests):
 * - `sessionId` is the agent-run id; event indexes are per-turn starting at 0.
 * - Replay is exclusive (`event_index > fromEventIndex`); `-1` means full replay.
 * - The server closes the response after a terminal event or when the run is inactive,
 *   so the hook stops reconnecting once it has seen a terminal event — the consumer
 *   re-arms it by passing the next turn's run id.
 */
export function useThreadStream({
	enabled = true,
	onConnectionChange,
	onEvent,
	sessionId,
	threadId,
}: UseThreadStreamOptions): void {
	const api = useApi();
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;
	const onConnectionChangeRef = useRef(onConnectionChange);
	onConnectionChangeRef.current = onConnectionChange;

	useEffect(() => {
		if (!enabled || !sessionId) return;

		let cancelled = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		// Per-turn cursor: -1 replays the whole turn; advance to the last seen
		// index as-is (replay is exclusive, so sending index N resumes at N+1).
		let lastIndex = -1;
		let sawTerminal = false;
		let retryMs = BASE_RETRY_MS;

		const controller = new AbortController();

		function handleEvent(event: ThreadMessageStreamEvent) {
			if ("index" in event && typeof event.index === "number") {
				lastIndex = event.index;
			}
			if (isTerminal(event)) {
				sawTerminal = true;
			}
			retryMs = BASE_RETRY_MS;
			onEventRef.current(event);
		}

		async function connect() {
			try {
				await api.streamThreadEvents({
					fromEventIndex: lastIndex,
					onActivity: () => onConnectionChangeRef.current?.(true),
					onEvent: handleEvent,
					sessionId: sessionId as string,
					signal: controller.signal,
					threadId,
				});
			} catch {
				// abort on unmount lands here too — only surface real failures
				if (!cancelled) onConnectionChangeRef.current?.(false);
				if (!cancelled && !sawTerminal) {
					const delay = retryMs;
					retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
					timeoutId = setTimeout(connect, delay);
				}
				return;
			}

			// Clean close: the server ended the stream. If the turn is over, stop —
			// reconnecting would only re-receive synthesized terminal events forever.
			if (!cancelled && !sawTerminal) {
				timeoutId = setTimeout(connect, retryMs);
			}
		}

		connect();

		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
			controller.abort();
		};
	}, [api, enabled, sessionId, threadId]);
}
