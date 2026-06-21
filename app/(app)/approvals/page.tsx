import { Suspense } from "react";
import { ApprovalsPage } from "@/features/approvals/approvals-page";

export default function Approvals() {
	return (
		<Suspense>
			<ApprovalsPage />
		</Suspense>
	);
}
