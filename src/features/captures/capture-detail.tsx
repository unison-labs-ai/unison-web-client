"use client";

import { useQuery } from "@tanstack/react-query";
import type { Capture, TranscriptSegment } from "@unison/contracts";
import { Mic } from "lucide-react";

import { useApi } from "@/lib/api-context";
import { Breadcrumb } from "@/ui/breadcrumb";
import { Button } from "@/ui/button";
import { SessionRow } from "@/ui/session-row";
import { Skeleton } from "@/ui/skeleton";
import { formatDuration } from "./captures-list";

// ---------------------------------------------------------------------------
// Transcript segment
// ---------------------------------------------------------------------------

function SegmentRow({ segment, index }: { index: number; segment: TranscriptSegment }) {
	const startSec =
		segment.startMs != null ? `${(segment.startMs / 1000).toFixed(1)}s` : `#${index + 1}`;

	return (
		<div
			style={{
				borderBottom: "1px solid var(--line)",
				display: "flex",
				gap: "12px",
				padding: "8px 0",
			}}
		>
			<span
				className="type-extrasmall"
				style={{
					color: "var(--ink-subtle)",
					flexShrink: 0,
					fontFamily: "var(--font-geist-mono), monospace",
					paddingTop: "2px",
					width: "48px",
				}}
			>
				{startSec}
			</span>
			<p
				className="type-small"
				style={{ color: "var(--ink)", flex: 1, lineHeight: "1.6", margin: 0 }}
			>
				{segment.text}
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Inner component (has data)
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
	deleted: "Deleted",
	draft: "Draft",
	failed: "Failed",
	finalized: "Finalized",
	processed: "Processed",
	processing: "Processing",
	recording: "Recording",
	transcribing: "Transcribing",
};

const TYPE_LABELS: Record<string, string> = {
	mixed: "Mixed",
	text: "Text",
	voice: "Voice",
};

function CaptureDetailInner({ capture }: { capture: Capture }) {
	const api = useApi();

	const isTranscribed = capture.status === "processed" || capture.status === "finalized";

	const {
		data: transcriptData,
		isLoading: transcriptLoading,
		isError: transcriptError,
		refetch: refetchTranscript,
	} = useQuery({
		enabled: isTranscribed,
		queryFn: () => api.getCaptureTranscript(capture.id),
		queryKey: ["capture-transcript", capture.id],
		staleTime: 300_000,
	});

	// Linked sessions: no reverse endpoint — derive linkage client-side from the
	// shared threads list (sessions carry captureId; limit 100 = backend max).
	const {
		data: threadsData,
		isLoading: threadsLoading,
		isError: threadsError,
		refetch: refetchThreads,
	} = useQuery({
		queryFn: () => api.listThreads({ limit: 100 }),
		queryKey: ["threads"],
		staleTime: 30_000,
	});

	const linkedSessions = (threadsData?.threads ?? []).filter(
		(thread) => thread.captureId === capture.id,
	);

	const segments = transcriptData?.segments ?? [];
	const duration = capture.durationMs != null ? formatDuration(capture.durationMs) : null;
	const hasAudio = capture.captureType !== "text";

	return (
		<div style={{ margin: "0 auto", maxWidth: "768px", padding: "32px 20px 80px" }}>
			<Breadcrumb
				className="mb-3"
				currentTag="span"
				items={[{ href: "/captures", label: "Captures" }, { label: capture.title ?? "Capture" }]}
			/>

			{/* Header */}
			<div style={{ marginBottom: "24px" }}>
				<h1 className="type-h3" style={{ color: "var(--ink)", margin: "0 0 6px" }}>
					{capture.title ??
						`${TYPE_LABELS[capture.captureType] ?? "Capture"} · ${new Date(capture.createdAt).toLocaleDateString()}`}
				</h1>
				<div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "8px" }}>
					<span
						style={{
							background: "var(--surface)",
							border: "1px solid var(--border)",
							borderRadius: "var(--radius-sm)",
							color: "var(--ink-subtle)",
							fontSize: "10px",
							fontWeight: 500,
							letterSpacing: "0.04em",
							padding: "2px 5px",
							textTransform: "uppercase",
						}}
					>
						{capture.captureType}
					</span>
					{capture.intent && (
						<span
							style={{
								background: "var(--surface)",
								border: "1px solid var(--border)",
								borderRadius: "var(--radius-sm)",
								color: "var(--ink-subtle)",
								fontSize: "10px",
								fontWeight: 500,
								letterSpacing: "0.04em",
								padding: "2px 5px",
								textTransform: "uppercase",
							}}
						>
							{capture.intent}
						</span>
					)}
					<span className="type-extrasmall" style={{ color: "var(--ink-subtle)" }}>
						{STATUS_LABELS[capture.status] ?? capture.status}
					</span>
					{duration && (
						<span className="type-extrasmall" style={{ color: "var(--ink-subtle)" }}>
							{duration}
						</span>
					)}
					<span className="type-extrasmall" style={{ color: "var(--ink-subtle)" }}>
						{new Date(capture.createdAt).toLocaleString()}
					</span>
				</div>
			</div>

			{/* Audio: the presigned-URL endpoint is blocked (ledgered), so render a
			    disabled affordance instead of nothing where the player belongs. */}
			{hasAudio && (
				<div
					style={{
						alignItems: "center",
						background: "var(--surface-muted)",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius-md)",
						display: "flex",
						gap: "10px",
						marginBottom: "24px",
						opacity: 0.75,
						padding: "12px 16px",
					}}
				>
					<Mic aria-hidden size={16} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
					<p className="type-small" style={{ color: "var(--ink-subtle)", margin: 0 }}>
						Audio playback isn&rsquo;t available on web yet — recorded on mobile.
					</p>
				</div>
			)}

			{/* Summary */}
			{capture.summary && (
				<div
					style={{
						background: "var(--surface)",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius-md)",
						marginBottom: "24px",
						padding: "14px 16px",
					}}
				>
					<p
						className="type-extrasmall"
						style={{ color: "var(--ink-subtle)", margin: "0 0 6px", textTransform: "uppercase" }}
					>
						Summary
					</p>
					<p className="type-small" style={{ color: "var(--ink)", lineHeight: "1.6", margin: 0 }}>
						{capture.summary}
					</p>
				</div>
			)}

			{/* Transcript */}
			<div style={{ marginBottom: "32px" }}>
				<h2
					className="type-small"
					style={{
						color: "var(--ink-subtle)",
						fontWeight: 500,
						letterSpacing: "0.04em",
						marginBottom: "8px",
						marginTop: 0,
						textTransform: "uppercase",
					}}
				>
					Transcript
				</h2>

				{!isTranscribed && (
					<p className="type-small" style={{ color: "var(--ink-subtle)", margin: 0 }}>
						{capture.transcriptText
							? capture.transcriptText
							: `Not yet transcribed (status: ${STATUS_LABELS[capture.status] ?? capture.status}).`}
					</p>
				)}

				{isTranscribed && transcriptLoading && (
					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} style={{ height: "36px", width: "100%" }} />
						))}
					</div>
				)}

				{isTranscribed && transcriptError && (
					<div
						style={{
							alignItems: "center",
							display: "flex",
							flexDirection: "column",
							gap: "10px",
							padding: "16px 0",
						}}
					>
						<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
							Failed to load transcript.
						</p>
						<Button onClick={() => void refetchTranscript()} variant="secondary">
							Retry
						</Button>
					</div>
				)}

				{isTranscribed &&
					!transcriptLoading &&
					!transcriptError &&
					segments.length === 0 &&
					capture.transcriptText && (
						<p
							className="type-small"
							style={{ color: "var(--ink)", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}
						>
							{capture.transcriptText}
						</p>
					)}

				{isTranscribed &&
					!transcriptLoading &&
					!transcriptError &&
					segments.length === 0 &&
					!capture.transcriptText && (
						<p className="type-small" style={{ color: "var(--ink-subtle)", margin: 0 }}>
							No transcript segments available.
						</p>
					)}

				{segments.map((seg, i) => (
					// Segments have no stable id — use index as key (list never reorders)
					// biome-ignore lint/suspicious/noArrayIndexKey: transcript segments have no id
					<SegmentRow index={i} key={i} segment={seg} />
				))}
			</div>

			{/* Linked sessions */}
			<div style={{ marginBottom: "32px" }}>
				<h2
					className="type-small"
					style={{
						color: "var(--ink-subtle)",
						fontWeight: 500,
						letterSpacing: "0.04em",
						marginBottom: "8px",
						marginTop: 0,
						textTransform: "uppercase",
					}}
				>
					Linked sessions
				</h2>

				{threadsLoading && (
					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						{[1, 2].map((i) => (
							<Skeleton key={i} style={{ height: "40px", width: "100%" }} />
						))}
					</div>
				)}

				{threadsError && (
					<div
						style={{
							alignItems: "center",
							background: "var(--danger-soft)",
							borderRadius: "var(--radius-md)",
							display: "flex",
							gap: "10px",
							justifyContent: "space-between",
							padding: "10px 12px",
						}}
					>
						<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
							Failed to load linked sessions.
						</p>
						<Button onClick={() => void refetchThreads()} size="sm" variant="secondary">
							Retry
						</Button>
					</div>
				)}

				{!threadsLoading && !threadsError && linkedSessions.length === 0 && (
					<p className="type-small" style={{ color: "var(--ink-subtle)", margin: 0 }}>
						No sessions started from this capture.
					</p>
				)}

				{!threadsLoading &&
					!threadsError &&
					linkedSessions.map((session) => <SessionRow key={session.id} session={session} />)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function CaptureDetailSkeleton() {
	return (
		<div style={{ margin: "0 auto", maxWidth: "768px", padding: "32px 20px" }}>
			<Skeleton style={{ height: "12px", marginBottom: "16px", width: "120px" }} />
			<Skeleton style={{ height: "28px", marginBottom: "8px", width: "280px" }} />
			<Skeleton style={{ height: "40px", marginBottom: "20px", width: "100%" }} />
			{[1, 2, 3, 4].map((i) => (
				<Skeleton key={i} style={{ height: "36px", marginBottom: "6px", width: "100%" }} />
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

type CaptureDetailProps = {
	captureId: string;
};

export function CaptureDetail({ captureId }: CaptureDetailProps) {
	const api = useApi();

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.getCapture(captureId),
		queryKey: ["capture", captureId],
		staleTime: 120_000,
	});

	if (isLoading) return <CaptureDetailSkeleton />;

	if (isError || !data) {
		return (
			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
					padding: "40px 24px",
				}}
			>
				<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
					Failed to load capture.
				</p>
				<Button onClick={() => void refetch()} variant="secondary">
					Retry
				</Button>
			</div>
		);
	}

	return <CaptureDetailInner capture={data.capture} />;
}
