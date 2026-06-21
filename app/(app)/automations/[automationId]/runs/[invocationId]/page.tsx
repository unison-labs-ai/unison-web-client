"use client";

import { use } from "react";

import { AutomationRunDetail } from "@/features/automations/automation-run-detail";

type Props = {
	params: Promise<{ automationId: string; invocationId: string }>;
};

export default function AutomationRunDetailPage({ params }: Props) {
	const { automationId, invocationId } = use(params);
	return <AutomationRunDetail automationId={automationId} invocationId={invocationId} />;
}
