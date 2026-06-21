"use client";

import { Loader2 } from "lucide-react";

import type { ToolPart } from "@/lib/session-transcript";
import { cn } from "@/ui/utils";
import { ToolCard } from "../tool-card";
import { moduleIcon, moduleKindLabel } from "./module-icon";
import { useModules } from "./modules-context";
import { moduleToolSpec } from "./registry";

// ---------------------------------------------------------------------------
// In-chat artifact chip (plan §6.5). Replaces the verbose tool card for
// module-producing tools: a compact, branded, clickable card that opens/focuses
// the module's tab. An edit-tool chip reads "Updated …" and points at the same
// tab. If the projection has no module for this call (e.g. an edit of an artifact
// created in another session), we fall back to the normal tool card so nothing
// is lost.
// ---------------------------------------------------------------------------

export function ArtifactChip({ toolPart }: { toolPart: ToolPart }) {
	const { activeId, focusModule, moduleForCallId, panelOpen } = useModules();
	const module = moduleForCallId(toolPart.callId);
	const spec = moduleToolSpec(toolPart.tool);

	if (!module) {
		return <ToolCard tool={toolPart} />;
	}

	const Icon = moduleIcon(module.kind);
	const streaming = module.status === "streaming";
	const failed = module.status === "error";
	const isActive = panelOpen && activeId === module.id;
	const verb = spec?.isEdit ? "Updated" : "Created";
	const subtitle = failed
		? "Failed"
		: streaming
			? "Writing…"
			: `${verb} ${moduleKindLabel(module.kind).toLowerCase()}`;

	return (
		<button
			aria-label={`Open ${module.title}`}
			className={cn(
				"group flex w-full items-center gap-3 rounded-lg border border-(--border) px-3 py-2.5 text-left transition-colors",
				isActive ? "bg-surface" : "bg-surface-muted hover:bg-surface",
			)}
			onClick={() => focusModule(module.id)}
			type="button"
		>
			<span
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-(--border) bg-surface",
					isActive ? "text-ink" : "text-ink-muted group-hover:text-ink",
				)}
			>
				<Icon size={15} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-medium text-ink">{module.title}</span>
				<span className={cn("truncate text-xs", failed ? "text-danger" : "text-ink-subtle")}>
					{subtitle}
				</span>
			</span>
			{streaming ? (
				<Loader2 className="animate-spin text-ink-subtle" size={14} />
			) : (
				<span className="shrink-0 text-xs text-ink-subtle group-hover:text-ink-muted">
					{isActive ? "Open" : "View"}
				</span>
			)}
		</button>
	);
}
