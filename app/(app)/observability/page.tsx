import { Suspense } from "react";

import { ObservabilitySkeleton } from "@/features/observability/internal-gate";
import { ObservabilityPage } from "@/features/observability/observability-page";

export default function ObservabilityRoute() {
	return (
		<Suspense fallback={<ObservabilitySkeleton />}>
			<ObservabilityPage />
		</Suspense>
	);
}
