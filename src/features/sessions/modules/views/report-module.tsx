"use client";

import { AssistantMarkdown } from "../../assistant-markdown";
import type { ReportModule } from "../types";

// Read-only artifact (report / dossier / briefing / ledger) — these are
// agent-owned `session_artifacts` with no client write path, so the module just
// renders the markdown body.

export function ReportModuleView({ module }: { module: ReportModule }) {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			<AssistantMarkdown text={module.markdown || "Generating…"} />
		</div>
	);
}
