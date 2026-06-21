"use client";

import { useQuery } from "@tanstack/react-query";
import type { Capture } from "@unison/contracts";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { relativeTime } from "@/lib/relative-time";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

const INTENT_LABELS: Record<string, string> = {
	meeting: "Meeting",
	note: "Note",
	request: "Request",
	unknown: "Capture",
};

const TYPE_LABELS: Record<string, string> = {
	mixed: "Mixed",
	text: "Text",
	voice: "Voice",
};

// Shared with capture-detail so both surfaces format durations identically.
export function formatDuration(ms: number | null | undefined): string {
	if (ms == null) return "";
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const remainS = s % 60;
	if (m === 0) return `${s}s`;
	return `${m}m ${remainS}s`;
}

function CaptureRow({
	capture,
	hasLinkedSession,
}: {
	capture: Capture;
	hasLinkedSession: boolean;
}) {
	const intentLabel = capture.intent ? (INTENT_LABELS[capture.intent] ?? "Capture") : "Capture";

	return (
		<Link
			href={`/captures/${capture.id}`}
			style={{
				alignItems: "center",
				borderBottom: "1px solid var(--line)",
				color: "inherit",
				display: "flex",
				gap: "10px",
				padding: "12px 0",
				textDecoration: "none",
			}}
		>
			{/* Type chip */}
			<span
				style={{
					background: "var(--surface)",
					border: "1px solid var(--border)",
					borderRadius: "var(--radius-sm)",
					color: "var(--ink-subtle)",
					flexShrink: 0,
					fontSize: "10px",
					fontWeight: 500,
					padding: "2px 5px",
					textTransform: "uppercase",
				}}
			>
				{intentLabel}
			</span>

			{/* Title */}
			<span
				className="type-small"
				style={{
					color: "var(--ink)",
					flex: 1,
					minWidth: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{capture.title ??
					`${TYPE_LABELS[capture.captureType] ?? "Capture"} · ${new Date(capture.createdAt).toLocaleDateString()}`}
			</span>

			{/* Duration */}
			{capture.durationMs != null && (
				<span className="type-extrasmall" style={{ color: "var(--ink-subtle)", flexShrink: 0 }}>
					{formatDuration(capture.durationMs)}
				</span>
			)}

			{/* Linked-session glyph */}
			{hasLinkedSession && (
				<span
					style={{
						alignItems: "center",
						color: "var(--ink-subtle)",
						display: "inline-flex",
						flexShrink: 0,
					}}
					title="Has linked session"
				>
					<MessageSquare aria-hidden size={13} />
				</span>
			)}

			{/* Relative time */}
			<span className="type-extrasmall" style={{ color: "var(--ink-subtle)", flexShrink: 0 }}>
				{relativeTime(capture.createdAt)}
			</span>
		</Link>
	);
}

export function CapturesList() {
	const api = useApi();

	// limit: 100 is the backend max — without it the list silently caps at 25.
	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listCaptures({ limit: 100 }),
		queryKey: ["captures"],
		staleTime: 60_000,
	});

	// Sessions carry captureId; derive which captures have ≥1 linked session
	// client-side. Query failure = silently no glyphs.
	const { data: threadsData } = useQuery({
		queryFn: () => api.listThreads({ limit: 100 }),
		queryKey: ["threads"],
		staleTime: 30_000,
	});

	const linkedCaptureIds = new Set(
		(threadsData?.threads ?? []).flatMap((thread) => (thread.captureId ? [thread.captureId] : [])),
	);

	const captures = data?.captures ?? [];

	return (
		<PageShell title="Captures">
			{isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} style={{ height: "48px", width: "100%" }} />
					))}
				</div>
			)}

			{isError && (
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
						Failed to load captures.
					</p>
					<Button onClick={() => void refetch()} variant="secondary">
						Retry
					</Button>
				</div>
			)}

			{!isLoading && !isError && captures.length === 0 && (
				<p
					className="type-small"
					style={{ color: "var(--ink-subtle)", margin: 0, padding: "24px 0" }}
				>
					No captures yet. Captures are recorded on the mobile app.
				</p>
			)}

			{!isLoading &&
				!isError &&
				captures.map((c) => (
					<CaptureRow capture={c} hasLinkedSession={linkedCaptureIds.has(c.id)} key={c.id} />
				))}
		</PageShell>
	);
}
