import { Suspense } from "react";

import { AutomationNew } from "@/features/automations/automation-new";

export default function AutomationNewPage() {
	return (
		<Suspense>
			<AutomationNew />
		</Suspense>
	);
}
