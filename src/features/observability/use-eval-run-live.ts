"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApi } from "@/lib/api-context";

type UseEvalRunLiveOptions = {
	/** Stream only while the run is active; flips false on terminal status. */
	active: boolean;
	runId: string;
};

const INVALIDATE_THROTTLE_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15_000;

/** Tails GET /runs/:id/events from the latest known eventIndex and refreshes
 * the detail query when metric events arrive. Reconnects with backoff while
 * the run is active; reports `degraded` so the caller can fall back to 5s
 * polling when the stream is down. */
export function useEvalRunLive({ active, runId }: UseEvalRunLiveOptions): { degraded: boolean } {
	const api = useApi();
	const queryClient = useQueryClient();
	const [degraded, setDegraded] = useState(false);
	// Survives reconnects within the mount so replays resume, not restart.
	const lastEventIndexRef = useRef<number | null>(null);

	useEffect(() => {
		if (!active) {
			setDegraded(false);
			return;
		}

		const controller = new AbortController();
		let cancelled = false;
		let attempt = 0;
		let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
		let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
		let invalidatePending = false;

		function invalidate() {
			void queryClient.invalidateQueries({ queryKey: ["eval-run", runId] });
			void queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
		}

		// Metric events can burst (one per item transition); coalesce refetches.
		function scheduleInvalidate() {
			if (invalidatePending) return;
			invalidatePending = true;
			invalidateTimer = setTimeout(() => {
				invalidatePending = false;
				if (!cancelled) invalidate();
			}, INVALIDATE_THROTTLE_MS);
		}

		async function connect() {
			try {
				await api.streamEvalRunEvents({
					fromEventIndex:
						lastEventIndexRef.current === null ? undefined : lastEventIndexRef.current + 1,
					onEvent: (event) => {
						attempt = 0;
						setDegraded(false);
						if (
							lastEventIndexRef.current === null ||
							event.eventIndex > lastEventIndexRef.current
						) {
							lastEventIndexRef.current = event.eventIndex;
						}
						scheduleInvalidate();
					},
					runId,
					signal: controller.signal,
				});
				// Clean close (e.g. the run reached a terminal status server-side):
				// refresh once so the page settles on the final snapshot.
				if (!cancelled) invalidate();
			} catch {
				if (!cancelled) setDegraded(true);
			}
			if (cancelled) return;
			attempt += 1;
			const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(attempt, 4));
			reconnectTimer = setTimeout(() => void connect(), delay);
		}

		void connect();
		return () => {
			cancelled = true;
			clearTimeout(reconnectTimer);
			clearTimeout(invalidateTimer);
			controller.abort();
		};
	}, [active, api, queryClient, runId]);

	return { degraded };
}
