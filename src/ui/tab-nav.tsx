"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "./utils";

export type TabNavItem<T extends string> = {
	id: T;
	label: string;
	/** Render the tab as a Link (settings sub-pages). Omit for button tabs. */
	href?: string;
};

/**
 * Shared tab strip (extracted from the settings sub-nav). A single sliding
 * highlight pill marks the ACTIVE tab and animates only when the selection
 * changes; hovering a tab just brightens its text.
 */
export function TabNav<T extends string>({
	activeId,
	ariaLabel,
	className,
	items,
	onSelect,
}: {
	activeId: T;
	ariaLabel: string;
	className?: string;
	items: TabNavItem<T>[];
	onSelect?: (id: T) => void;
}) {
	const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null);
	const tabRefs = useRef(new Map<T, HTMLElement>());

	useLayoutEffect(() => {
		const el = tabRefs.current.get(activeId);
		if (el) setHighlight({ left: el.offsetLeft, width: el.offsetWidth });
	}, [activeId]);

	return (
		<nav aria-label={ariaLabel} className={cn("relative flex", className)} style={{ gap: "0" }}>
			{highlight && (
				<div
					aria-hidden
					className="bg-primary-soft rounded-md"
					style={{
						height: "100%",
						left: highlight.left,
						pointerEvents: "none",
						position: "absolute",
						top: 0,
						transition: "left 180ms ease, width 180ms ease",
						width: highlight.width,
					}}
				/>
			)}
			{items.map((item) => {
				const isActive = activeId === item.id;
				const setRef = (el: HTMLElement | null) => {
					if (el) tabRefs.current.set(item.id, el);
					else tabRefs.current.delete(item.id);
				};
				const style: React.CSSProperties = {
					display: "inline-block",
					fontSize: "13px",
					fontWeight: isActive ? 500 : 400,
					padding: "8px 16px",
					position: "relative",
					textDecoration: "none",
				};
				const textClass = cn("rounded-md", isActive ? "text-ink" : "text-ink-muted hover:text-ink");

				return item.href ? (
					<Link className={textClass} href={item.href} key={item.id} ref={setRef} style={style}>
						{item.label}
					</Link>
				) : (
					<button
						className={cn(textClass, "border-none bg-transparent")}
						key={item.id}
						onClick={() => onSelect?.(item.id)}
						ref={setRef}
						style={style}
						type="button"
					>
						{item.label}
					</button>
				);
			})}
		</nav>
	);
}
