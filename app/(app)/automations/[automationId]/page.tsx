"use client";

import { Suspense, use } from "react";

import { AutomationDetail } from "@/features/automations/automation-detail";

type Props = {
	params: Promise<{ automationId: string }>;
};

export default function AutomationDetailPage({ params }: Props) {
	const { automationId } = use(params);
	return (
		<Suspense>
			<AutomationDetail automationId={automationId} />
		</Suspense>
	);
}
