"use client";

import { use } from "react";
import { ConnectionDetail } from "@/features/connections/connection-detail";

export default function ConnectionDetailPage({
	params,
}: {
	params: Promise<{ provider: string }>;
}) {
	const { provider } = use(params);
	return <ConnectionDetail provider={provider} />;
}
