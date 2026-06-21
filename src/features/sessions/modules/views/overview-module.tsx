"use client";

import { ChevronRight } from "lucide-react";

import { moduleIcon, moduleKindLabel } from "../module-icon";
import { useModules } from "../modules-context";

// The artifacts overview: a list of everything this session produced — email
// drafts, documents, reports, and the recording transcript — each a row that
// opens that artifact's module. The session header's artifacts button focuses
// this module, mirroring the assistant's "artifacts" index panel.

export function OverviewModuleView() {
	const { focusModule, modules } = useModules();
	const entries = modules.filter((module) => module.kind !== "overview");

	if (entries.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
				<p className="text-sm font-medium text-ink-muted">Nothing here yet</p>
				<p className="text-xs text-ink-subtle">
					Email drafts, documents, and transcripts from this chat will show up here.
				</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
			{entries.map((module) => {
				const Icon = moduleIcon(module.kind);

				return (
					<button
						className="group flex w-full items-center gap-3 rounded-lg border border-(--border) bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
						key={module.id}
						onClick={() => focusModule(module.id)}
						type="button"
					>
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-(--border) bg-surface-muted text-ink-muted group-hover:text-ink">
							<Icon size={15} />
						</span>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium text-ink">{module.title}</span>
							<span className="truncate text-xs text-ink-subtle">
								{moduleKindLabel(module.kind)}
							</span>
						</span>
						<ChevronRight className="shrink-0 text-ink-subtle" size={15} />
					</button>
				);
			})}
		</div>
	);
}
