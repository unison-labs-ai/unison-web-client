"use client";

import { ApiProvider } from "@/lib/api-context";
import { QueryProvider } from "@/lib/query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<ApiProvider>
			<QueryProvider>{children}</QueryProvider>
		</ApiProvider>
	);
}
