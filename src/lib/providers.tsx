"use client";

import { ApiProvider } from "@/lib/api-context";
import { AppEventsProvider } from "@/lib/app-events-provider";
import { QueryProvider } from "@/lib/query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<ApiProvider>
			<QueryProvider>
				<AppEventsProvider>{children}</AppEventsProvider>
			</QueryProvider>
		</ApiProvider>
	);
}
