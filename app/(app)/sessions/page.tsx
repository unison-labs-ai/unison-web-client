import { Suspense } from "react";
import { SessionsList } from "@/features/sessions/sessions-list";
import { PageShell } from "@/features/shell/page-shell";
import { Skeleton } from "@/ui/skeleton";

function LoadingFallback() {
	return (
		<PageShell>
			<Skeleton style={{ height: "28px", marginBottom: "20px", width: "120px" }} />
			<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} style={{ height: "44px", width: "100%" }} />
				))}
			</div>
		</PageShell>
	);
}

export default function SessionsPage() {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<SessionsList />
		</Suspense>
	);
}
