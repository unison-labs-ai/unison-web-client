"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WebApiError } from "@/lib/api";

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
	if (error instanceof WebApiError && (error.status === 401 || error.status === 429)) {
		return false;
	}

	return failureCount < 3;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						retry: shouldRetryQuery,
					},
				},
			}),
	);
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
