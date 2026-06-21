"use client";

import type { Session } from "@unison/contracts";
import Link from "next/link";
import { relativeTime } from "@/lib/relative-time";
import { usePrefetchThread } from "@/lib/thread-cache";

const ORIGIN_LABELS: Record<string, string> = {
	automation: "Automation",
	capture: "Capture",
	connector: "Connector",
	system: "System",
	user: "Chat",
};

// No live indicator: session.status is the lifecycle enum (open/archived/
// deleted), not mid-turn state — a real presence signal needs backend support.
export function SessionRow({ session }: { session: Session }) {
	const lastAt = session.lastMessageAt ?? session.updatedAt ?? session.createdAt;
	// Warm the thread + message caches on intent — Link's own prefetch only
	// covers the route shell; this covers the data so the open paints full.
	const prefetch = usePrefetchThread(session.id);

	return (
		<Link
			className="-mx-2 flex items-center gap-[10px] rounded-md border-b border-(--line) px-2 py-[10px] text-inherit no-underline hover:bg-primary-soft"
			href={`/sessions/${session.id}`}
			onFocus={prefetch}
			onMouseEnter={prefetch}
			onTouchStart={prefetch}
		>
			<span
				style={{
					background: "var(--surface)",
					border: "1px solid var(--border)",
					borderRadius: "var(--radius-sm)",
					color: "var(--ink-subtle)",
					display: "inline-block",
					flexShrink: 0,
					fontSize: "10px",
					fontWeight: 500,
					padding: "2px 5px",
					textTransform: "uppercase",
				}}
			>
				{ORIGIN_LABELS[session.origin] ?? session.origin}
			</span>
			<span
				className="type-small"
				style={{
					color: "var(--ink)",
					flex: 1,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{session.title ?? "Untitled session"}
			</span>
			<span className="type-extrasmall" style={{ color: "var(--ink-subtle)", flexShrink: 0 }}>
				{relativeTime(lastAt)}
			</span>
		</Link>
	);
}
