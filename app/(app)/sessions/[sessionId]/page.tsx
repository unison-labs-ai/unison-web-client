import { Suspense } from "react";

import { SessionViewSkeleton } from "@/features/sessions/session-skeleton";
import { SessionView } from "@/features/sessions/session-view";

type Props = {
	params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: Props) {
	const { sessionId } = await params;
	return (
		<Suspense fallback={<SessionViewSkeleton />}>
			<SessionView sessionId={sessionId} />
		</Suspense>
	);
}
