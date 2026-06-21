"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { cn } from "./utils";

/**
 * Shared page furniture (settings, automations, …). Pages render static
 * structure (headers, cards) immediately and swap only row interiors between
 * skeleton and content, so navigation never flashes or jumps layout.
 */

const emptySubscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards. Pages must keep
 * showing their skeleton until hydrated: the server always renders queries as
 * pending, so a query that resolves before hydration reaches the subtree
 * would otherwise mismatch the server HTML.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);
}

/** Page/tab content wrapper — fades the content in on mount. */
export function PageFade({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				animation: "fade-up 220ms ease-out",
				display: "flex",
				flexDirection: "column",
				gap: "28px",
			}}
		>
			{children}
		</div>
	);
}

export function PageSection({
	actions,
	children,
	description,
	title,
}: {
	actions?: ReactNode;
	children?: ReactNode;
	description?: string;
	title: ReactNode;
}) {
	return (
		<section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
			<div style={{ alignItems: "flex-start", display: "flex", gap: "12px" }}>
				<div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "2px", minWidth: 0 }}>
					<h2
						style={{
							color: "var(--ink)",
							fontSize: "14px",
							fontWeight: 500,
							margin: 0,
						}}
					>
						{title}
					</h2>
					{description ? (
						<p
							style={{
								color: "var(--ink-muted)",
								fontSize: "12px",
								lineHeight: "1.5",
								margin: 0,
								maxWidth: "520px",
							}}
						>
							{description}
						</p>
					) : null}
				</div>
				{actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
			</div>
			{children}
		</section>
	);
}

/**
 * Collapsible section card (Town-style settings accordion). The whole header
 * row toggles; content collapses with a height transition. Children manage
 * their own padding — most sections compose GroupRow / field blocks and want
 * the hairline rhythm of `.group-card`, so the body applies it.
 */
export function CollapsibleCard({
	children,
	defaultOpen = true,
	description,
	meta,
	title,
}: {
	children: ReactNode;
	defaultOpen?: boolean;
	/** One-liner under the header, e.g. "When this automation runs." */
	description?: string;
	/** Inline annotation after the title (count, warning icon, lock). */
	meta?: ReactNode;
	title: string;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<section
			style={{
				background: "var(--surface-muted)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<button
				aria-expanded={open}
				className="flex w-full items-center gap-2 border-none bg-transparent px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ring)"
				onClick={() => setOpen((previous) => !previous)}
				style={{ minHeight: "48px", padding: "13px 16px" }}
				type="button"
			>
				<h2 style={{ color: "var(--ink)", fontSize: "14px", fontWeight: 500, margin: 0 }}>
					{title}
				</h2>
				{meta}
				<span aria-hidden style={{ flex: 1 }} />
				<ChevronDown
					size={15}
					style={{
						color: "var(--ink-subtle)",
						flexShrink: 0,
						transform: open ? "rotate(180deg)" : "rotate(0deg)",
						transition: "transform 180ms ease",
					}}
				/>
			</button>
			<div
				style={{
					display: "grid",
					gridTemplateRows: open ? "1fr" : "0fr",
					transition: "grid-template-rows 220ms ease",
				}}
			>
				<div style={{ minHeight: 0, overflow: "hidden" }}>
					{description ? (
						<p
							style={{
								color: "var(--ink-muted)",
								fontSize: "12px",
								lineHeight: "1.5",
								margin: 0,
								maxWidth: "520px",
								padding: "0 16px 12px",
							}}
						>
							{description}
						</p>
					) : null}
					<div className="group-card flex flex-col">{children}</div>
				</div>
			</div>
		</section>
	);
}

/** Grouped card — direct children are separated by hairlines (.group-card CSS). */
export function GroupCard({ children }: { children: ReactNode }) {
	return (
		<div
			className="group-card"
			style={{
				background: "var(--surface-muted)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{children}
		</div>
	);
}

/** Label + description on the left, control (children) on the right. */
export function GroupRow({
	children,
	danger,
	description,
	title,
}: {
	children?: ReactNode;
	danger?: boolean;
	description?: ReactNode;
	title: ReactNode;
}) {
	return (
		<div
			style={{
				alignItems: "center",
				display: "flex",
				flexWrap: "wrap",
				gap: "12px",
				justifyContent: "space-between",
				padding: "12px 16px",
			}}
		>
			<div
				style={{
					display: "flex",
					flex: "1 1 240px",
					flexDirection: "column",
					gap: "2px",
					minWidth: 0,
				}}
			>
				<span
					style={{
						color: danger ? "var(--danger)" : "var(--ink)",
						fontSize: "13px",
						fontWeight: 500,
						wordBreak: "break-word",
					}}
				>
					{title}
				</span>
				{description ? (
					<span
						style={{
							color: "var(--ink-muted)",
							fontSize: "12px",
							lineHeight: "16px",
							maxWidth: "480px",
						}}
					>
						{description}
					</span>
				) : null}
			</div>
			{children ? (
				<div
					style={{
						alignItems: "flex-end",
						display: "flex",
						flexDirection: "column",
						gap: "4px",
					}}
				>
					{children}
				</div>
			) : null}
		</div>
	);
}

/** Inline segmented option picker (permission decisions, retention modes).
 *  A single thumb marks the selected option and slides to the option you
 *  click; hovering an option only brightens its text — no hover background. */
export function SegmentedControl<T extends string>({
	disabled,
	isOptionDisabled,
	onChange,
	options,
	value,
}: {
	disabled?: boolean;
	isOptionDisabled?: (value: T) => boolean;
	onChange: (value: T) => void;
	options: readonly { label: string; value: T }[];
	value: T;
}) {
	const optionRefs = useRef(new Map<T, HTMLButtonElement>());
	const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

	useLayoutEffect(() => {
		const el = optionRefs.current.get(value);
		if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
	}, [value]);

	return (
		<div
			style={{
				background: "var(--surface)",
				borderRadius: "var(--radius-md)",
				display: "flex",
				gap: "2px",
				padding: "2px",
				position: "relative",
				width: "fit-content",
			}}
		>
			{thumb && (
				<div
					aria-hidden
					style={{
						background: "var(--primary-soft)",
						borderRadius: "var(--radius-md)",
						bottom: "2px",
						left: thumb.left,
						pointerEvents: "none",
						position: "absolute",
						top: "2px",
						transition: "left 180ms ease, width 180ms ease",
						width: thumb.width,
					}}
				/>
			)}
			{options.map((option) => {
				const isActive = option.value === value;
				return (
					<button
						className={cn(
							"relative h-7 rounded-md border-none bg-transparent px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:pointer-events-none disabled:opacity-50",
							isActive ? "text-ink" : "text-ink-muted hover:text-ink",
						)}
						disabled={disabled || isOptionDisabled?.(option.value)}
						key={option.value}
						onClick={() => onChange(option.value)}
						ref={(el) => {
							if (el) optionRefs.current.set(option.value, el);
							else optionRefs.current.delete(option.value);
						}}
						type="button"
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

export function GroupRowSkeleton({ controlWidth = 96 }: { controlWidth?: number }) {
	return (
		<div
			style={{
				alignItems: "center",
				display: "flex",
				gap: "12px",
				justifyContent: "space-between",
				padding: "12px 16px",
			}}
		>
			<div
				style={{
					display: "flex",
					flex: 1,
					flexDirection: "column",
					gap: "6px",
					minWidth: 0,
				}}
			>
				<Skeleton style={{ height: "13px", maxWidth: "100%", width: "140px" }} />
				<Skeleton style={{ height: "10px", maxWidth: "100%", width: "220px" }} />
			</div>
			<Skeleton
				style={{
					borderRadius: "var(--radius-md)",
					flexShrink: 0,
					height: "32px",
					width: `${controlWidth}px`,
				}}
			/>
		</div>
	);
}

export function GroupCardSkeleton({
	controlWidth,
	rows = 3,
}: {
	controlWidth?: number;
	rows?: number;
}) {
	return (
		<GroupCard>
			{Array.from({ length: rows }, (_, index) => index).map((row) => (
				<GroupRowSkeleton controlWidth={controlWidth} key={row} />
			))}
		</GroupCard>
	);
}

/** Section header bar + card of skeleton rows, for pages whose headers are data-driven. */
export function PageSectionSkeleton({
	controlWidth,
	rows = 3,
}: {
	controlWidth?: number;
	rows?: number;
}) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
			<Skeleton style={{ height: "14px", width: "120px" }} />
			<GroupCardSkeleton controlWidth={controlWidth} rows={rows} />
		</div>
	);
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div
			style={{
				alignItems: "center",
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				padding: "24px 0",
			}}
		>
			<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
				{message}
			</p>
			<Button onClick={onRetry} variant="secondary">
				Retry
			</Button>
		</div>
	);
}

export function EmptyState({ message }: { message: string }) {
	return (
		<p
			className="type-small"
			style={{
				color: "var(--ink-muted)",
				margin: 0,
				padding: "24px 0",
				textAlign: "center",
			}}
		>
			{message}
		</p>
	);
}
