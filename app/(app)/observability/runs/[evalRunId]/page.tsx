import { Suspense } from "react";

import { ObservabilitySkeleton } from "@/features/observability/internal-gate";
import { EvalRunDetailPage } from "@/features/observability/run-detail-page";

type Props = {
	params: Promise<{ evalRunId: string }>;
};

export default async function EvalRunDetailRoute({ params }: Props) {
	const { evalRunId } = await params;
	return (
		<Suspense fallback={<ObservabilitySkeleton />}>
			<EvalRunDetailPage runId={evalRunId} />
		</Suspense>
	);
}
