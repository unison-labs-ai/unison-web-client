"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useApi } from "@/lib/api-context";

// Shared cache identities for the automation queries so the list rows, hover
// prefetch and the detail view all hit the same entries.
export const AUTOMATION_STALE_TIME = 30_000;

export function automationQueryKey(automationId: string) {
	return ["automation", automationId] as const;
}

/** Warms the automation detail cache on link intent (hover/focus/touch) so
 * opening an automation usually paints with data already in memory.
 * prefetchQuery dedupes in-flight fetches and respects staleTime, so repeat
 * hovers are free; prefetch failures are swallowed and the detail view's own
 * load surfaces the error. */
export function usePrefetchAutomation(automationId: string) {
	const api = useApi();
	const queryClient = useQueryClient();

	return useCallback(() => {
		void queryClient.prefetchQuery({
			queryFn: () => api.getAutomation(automationId),
			queryKey: automationQueryKey(automationId),
			staleTime: AUTOMATION_STALE_TIME,
		});
	}, [api, automationId, queryClient]);
}
