import { Suspense } from "react";

import { AutomationsList } from "@/features/automations/automations-list";

export default function AutomationsPage() {
	return (
		<Suspense>
			<AutomationsList />
		</Suspense>
	);
}
