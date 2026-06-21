"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/ui/utils";
import { moduleIcon } from "./module-icon";
import { useModules } from "./modules-context";
import type { Module } from "./types";

// Chrome-style tab strip, ported from the original Unison session-tabs. The
// active tab is bordered on top + sides (open bottom) and its two concave
// corners are inline SVGs whose stroked arc carries the module's border out of
// the tab's side and back into the canvas's top edge. A ResizeObserver collapses
// each tab as it narrows, and the close button is overlaid with a gradient fade
// (no flex slot) so the title runs full-width and dissolves into the tab instead
// of truncating early.

const TAB_BG = "var(--surface-muted)";
const TAB_BORDER = "var(--border)";
const INACTIVE_CLOSE_MIN_WIDTH = 96;
const ACTIVE_HIDE_ICON_WIDTH = 74;
const INACTIVE_ICON_ONLY_WIDTH = 64;

export function ModuleTabs() {
	const { activeId, closeModule, focusModule, openModules } = useModules();

	return (
		<div className="relative z-10 flex h-10 shrink-0 items-start gap-1 overflow-visible px-[18px]">
			{openModules.map((module) => (
				<TabPill
					active={module.id === activeId}
					key={module.id}
					module={module}
					onClose={() => closeModule(module.id)}
					onSelect={() => focusModule(module.id)}
				/>
			))}
		</div>
	);
}

function TabPill({
	active,
	module,
	onClose,
	onSelect,
}: {
	active: boolean;
	module: Module;
	onClose: () => void;
	onSelect: () => void;
}) {
	const Icon = moduleIcon(module.kind);
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState<number | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}

		const update = (value: number) => {
			const next = Math.round(value);
			setWidth((current) => (current === next ? current : next));
		};

		update(element.getBoundingClientRect().width);
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				update(entry.contentRect.width);
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const measured = width ?? INACTIVE_CLOSE_MIN_WIDTH;
	const showClose = active || measured >= INACTIVE_CLOSE_MIN_WIDTH;
	const hideIcon = active && measured < ACTIVE_HIDE_ICON_WIDTH;
	const showTitle = active || measured >= INACTIVE_ICON_ONLY_WIDTH;

	return (
		<div
			className={cn(
				"group relative flex min-w-0 max-w-[200px] flex-[1_1_160px] items-center text-sm [--tab-bg:var(--surface-muted)]",
				active
					? "z-10 h-10 rounded-t-lg border border-b-0 border-(--border) bg-surface-muted pb-[3px] text-ink"
					: "z-0 h-9 rounded-md text-ink-muted [--tab-bg:var(--background)] hover:bg-surface hover:text-ink hover:[--tab-bg:var(--surface)]",
			)}
			ref={ref}
		>
			{active ? <ActiveTabJoin /> : null}
			<button
				className={cn(
					"relative z-10 flex h-9 min-w-0 flex-1 items-center gap-1.5 overflow-hidden pl-2.5 text-left",
					active && "-mt-px",
					showTitle ? "" : "justify-center",
				)}
				onClick={onSelect}
				title={module.title}
				type="button"
			>
				{hideIcon ? null : <Icon className="shrink-0" size={13} />}
				{showTitle ? <span className="min-w-0 truncate text-[13px]">{module.title}</span> : null}
			</button>
			{showClose ? (
				<div
					className={cn(
						"pointer-events-none absolute top-0 right-0 z-20 flex h-9 w-[min(44px,100%)] items-center justify-end bg-[linear-gradient(to_right,transparent_0%,var(--tab-bg)_42%)] pr-1.5",
						// Sit inside the top border (no -mt-px) so the fade never paints over it.
						active && "rounded-tr-lg",
					)}
				>
					<button
						aria-label={`Close ${module.title}`}
						className="pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-surface hover:text-ink"
						onClick={(event) => {
							event.stopPropagation();
							onClose();
						}}
						type="button"
					>
						<X size={12} />
					</button>
				</div>
			) : (
				<span
					aria-hidden
					className="pointer-events-none absolute top-0 right-0 z-20 h-9 w-[min(22px,45%)] bg-[linear-gradient(to_right,transparent,var(--tab-bg))]"
				/>
			)}
		</div>
	);
}

function ActiveTabJoin() {
	return (
		<>
			{/* Cover the canvas's top border under the tab + the tab's own side
			    borders at the very bottom, so the flares take over cleanly. */}
			<span
				aria-hidden
				className="pointer-events-none absolute right-0 -bottom-px left-0 h-0.5 bg-surface-muted"
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute -left-px bottom-0 h-2.5 w-px bg-surface-muted"
			/>
			<span
				aria-hidden
				className="pointer-events-none absolute right-[-1px] bottom-0 h-2.5 w-px bg-surface-muted"
			/>
			{/* Left concave flare */}
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative tab-corner flare */}
			<svg
				aria-hidden
				className="pointer-events-none absolute -bottom-[1.5px] -left-[10.5px] h-[11.5px] w-2.5 overflow-visible"
				viewBox="0 0 10 11.5"
			>
				<path d="M10 0A10 10 0 0 1 0 10V11.5H10V0Z" style={{ fill: TAB_BG }} />
				<path
					d="M10 0A10 10 0 0 1 0 10.5"
					style={{ fill: "none", stroke: TAB_BORDER, strokeWidth: 1 }}
				/>
			</svg>
			{/* Right concave flare */}
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative tab-corner flare */}
			<svg
				aria-hidden
				className="pointer-events-none absolute right-[-10.5px] -bottom-[1.5px] h-[11.5px] w-2.5 overflow-visible"
				viewBox="0 0 10 11.5"
			>
				<path d="M0 0A10 10 0 0 0 10 10V11.5H0V0Z" style={{ fill: TAB_BG }} />
				<path
					d="M0 0A10 10 0 0 0 10 10.5"
					style={{ fill: "none", stroke: TAB_BORDER, strokeWidth: 1 }}
				/>
			</svg>
		</>
	);
}
