"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { automationSeedParts, Composer } from "@/features/home/composer";
import { PageHeader } from "@/features/shell/page-shell";

// Automations are created conversationally (screens.md §5): this page is just
// the shared chat composer pre-seeded with the automation prompt — sending
// starts a session where the agent does the setup. Template cards land here
// with ?template=, which seeds the template variant of the prompt.

export function AutomationNew() {
	const searchParams = useSearchParams();
	const template = searchParams.get("template");
	const seed = useMemo(() => automationSeedParts(template), [template]);
	const [value, setValue] = useState("");

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				margin: "0 auto",
				maxWidth: "768px",
				minHeight: "100%",
				padding: "24px 20px 12vh",
				width: "100%",
			}}
		>
			<PageHeader title="New automation" />
			<Composer onChange={setValue} seed={seed} value={value} />
			<p className="type-small" style={{ color: "var(--ink-subtle)", margin: "12px 2px 0" }}>
				Describe what it should do in plain language — sending starts a chat where the agent sets it
				up with you.
			</p>
		</div>
	);
}
