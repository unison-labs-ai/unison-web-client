"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/ui/utils";
import { useModules } from "./modules-context";

// ---------------------------------------------------------------------------
// Left-edge resize handle for the module panel (plan §6.8.3). Resizing mutates
// width state with NO width/margin transition anywhere in the pane, so the drag
// is 1:1 with the cursor — the only animated thing here is the grab chip's
// opacity. On hover/drag a chip in var(--ink) (the primary text color) signals
// the edge is draggable.
// ---------------------------------------------------------------------------

export function ModuleResizer() {
	const { panelWidth, persistPanelWidth, setPanelWidth } = useModules();
	const [dragging, setDragging] = useState(false);
	const widthRef = useRef(panelWidth);
	widthRef.current = panelWidth;

	const startResize = useCallback(
		(event: React.PointerEvent) => {
			event.preventDefault();
			(event.target as Element).setPointerCapture?.(event.pointerId);
			setDragging(true);
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";

			const startX = event.clientX;
			const startWidth = widthRef.current;

			const onMove = (move: PointerEvent) => {
				// Panel grows as the handle is dragged left.
				setPanelWidth(startWidth + (startX - move.clientX));
			};

			const onUp = () => {
				setDragging(false);
				document.body.style.userSelect = "";
				document.body.style.cursor = "";
				persistPanelWidth();
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				window.removeEventListener("pointercancel", onUp);
			};

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			window.addEventListener("pointercancel", onUp);
		},
		[persistPanelWidth, setPanelWidth],
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: an interactive drag-resize separator has no native HTML element
		<div
			aria-label="Resize panel"
			aria-orientation="vertical"
			aria-valuemax={800}
			aria-valuemin={320}
			aria-valuenow={panelWidth}
			className="group relative w-[7px] shrink-0 cursor-col-resize touch-none select-none outline-none max-md:hidden"
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft") {
					event.preventDefault();
					setPanelWidth(panelWidth + 24);
				} else if (event.key === "ArrowRight") {
					event.preventDefault();
					setPanelWidth(panelWidth - 24);
				}
			}}
			onPointerDown={startResize}
			role="separator"
			tabIndex={0}
		>
			{/* Grab chip — hidden at rest; appears muted on hover, and while
			    dragging turns to the primary white and grows 4px taller each end. */}
			<span
				aria-hidden
				className={cn(
					"pointer-events-none absolute top-1/2 left-1/2 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-all duration-150 group-hover:opacity-100",
					dragging ? "h-11 bg-(--ink) opacity-100" : "h-9 bg-(--ink-muted)",
				)}
			/>
		</div>
	);
}
