"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useApi } from "@/lib/api-context";

// Shared cache identities for the thread queries so the session view, list
// rows and hover prefetch all hit the same entries. Invalidating the
// ["thread", id] prefix (as the session view does after a turn) covers the
// messages key too.
export const THREAD_STALE_TIME = 30_000;
export const THREAD_MESSAGES_STALE_TIME = 15_000;

export function threadQueryKey(threadId: string) {
	return ["thread", threadId] as const;
}

export function threadMessagesQueryKey(threadId: string) {
	return ["thread", threadId, "messages"] as const;
}

/** Warms the thread + message caches on link intent (hover/focus/touch) so
 * navigating into a session usually paints with data already in memory.
 * prefetchQuery dedupes in-flight fetches and respects staleTime, so repeat
 * hovers are free; prefetch failures are swallowed and the view's own load
 * surfaces the error. */
export function usePrefetchThread(threadId: string) {
	const api = useApi();
	const queryClient = useQueryClient();

	return useCallback(() => {
		void queryClient.prefetchQuery({
			queryFn: () => api.getThread(threadId),
			queryKey: threadQueryKey(threadId),
			staleTime: THREAD_STALE_TIME,
		});
		void queryClient.prefetchQuery({
			queryFn: () => api.listThreadMessages(threadId),
			queryKey: threadMessagesQueryKey(threadId),
			staleTime: THREAD_MESSAGES_STALE_TIME,
		});
	}, [api, queryClient, threadId]);
}
