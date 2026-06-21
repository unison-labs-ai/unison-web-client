"use client";

import type { CSSProperties } from "react";

import { ModuleCanvas } from "./module-canvas";
import { ModuleResizer } from "./module-resizer";
import { ModuleTabs } from "./module-tabs";
import { useModules } from "./modules-context";

// ---------------------------------------------------------------------------
// The session module panel (plan §6.8.1). An in-flow sibling of the chat column,
// NOT a shell-portaled aside — so resizing is a synchronous width change with no
// margin animation. On phone it becomes a full-screen overlay (no resize).
// ---------------------------------------------------------------------------

export function ModulePanel() {
	const { panelOpen, panelWidth } = useModules();

	if (!panelOpen) {
		return null;
	}

	return (
		<>
			<ModuleResizer />
			{/* z-40 so the open panel sits above the canvas notification bell (z-30). */}
			<aside
				className="flex min-h-0 w-full flex-col max-md:fixed max-md:inset-0 max-md:z-40 md:relative md:z-40 md:w-[var(--module-panel-w)] md:shrink-0"
				style={{ "--module-panel-w": `${panelWidth}px` } as CSSProperties}
			>
				{/* Tabs float on the page background; the card below is the cohesive
				    module surface they merge into. */}
				<ModuleTabs />
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-(--border) bg-surface-muted shadow-sm max-md:border-0 md:rounded-lg">
					<ModuleCanvas />
				</div>
			</aside>
		</>
	);
}
