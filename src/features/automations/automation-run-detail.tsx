"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { SessionView } from "@/features/sessions";
import { useApi } from "@/lib/api-context";
import { Badge } from "@/ui/badge";
import { Breadcrumb } from "@/ui/breadcrumb";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Run status stays neutral ink — only problems get color.
const STATUS_COLOR: Record<string, string> = {
	approval_needed: "var(--warning)",
	failed: "var(--danger)",
};

const EVENT_SEVERITY_COLOR: Record<string, string> = {
	error: "var(--danger)",
	info: "var(--ink-subtle)",
	warning: "var(--warning)",
};

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
	if (!startedAt || !finishedAt) return "—";
	const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function shortId(id: string): string {
	return id.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Field row helper
// ---------------------------------------------------------------------------

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div
			style={{
				borderBottom: "1px solid var(--line)",
				display: "flex",
				gap: "12px",
				padding: "10px 0",
			}}
		>
			<p
				style={{
					color: "var(--ink-subtle)",
					fontSize: "11px",
					fontWeight: 500,
					letterSpacing: "0.04em",
					margin: 0,
					textTransform: "uppercase",
					width: "120px",
					flexShrink: 0,
				}}
			>
				{label}
			</p>
			<div style={{ color: "var(--ink)", flex: 1, fontSize: "13px" }}>{children}</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RunDetailSkeleton() {
	return (
		<div style={{ margin: "0 auto", maxWidth: "768px", padding: "32px 20px" }}>
			<Skeleton style={{ height: "12px", marginBottom: "16px", width: "200px" }} />
			<Skeleton style={{ height: "28px", marginBottom: "24px", width: "280px" }} />
			{[1, 2, 3, 4, 5].map((i) => (
				<Skeleton key={i} style={{ height: "40px", marginBottom: "6px", width: "100%" }} />
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

type AutomationRunDetailProps = {
	automationId: string;
	invocationId: string;
};

export function AutomationRunDetail({ automationId, invocationId }: AutomationRunDetailProps) {
	const api = useApi();

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.getAutomationRunDetail({ automationId, invocationId }),
		queryKey: ["automation-run", automationId, invocationId],
		staleTime: 60_000,
	});

	if (isLoading) return <RunDetailSkeleton />;

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
				<p style={{ color: "var(--danger)", fontSize: "13px", margin: 0 }}>
					Failed to load run detail.
				</p>
				<Button onClick={() => void refetch()} variant="secondary">
					Retry
				</Button>
			</div>
		);
	}

	const { invocation, automation, runSummary, events } = data;

	const invocationStatus = invocation.runSummary?.status ?? invocation.status;
	const statusColor = STATUS_COLOR[invocationStatus] ?? "var(--ink-subtle)";

	return (
		<div style={{ margin: "0 auto", maxWidth: "768px", padding: "32px 20px 80px" }}>
			<Breadcrumb
				className="mb-3"
				currentTag="span"
				items={[
					{ href: "/automations", label: "Automations" },
					{ href: `/automations/${automationId}`, label: automation.name },
					{ href: `/automations/${automationId}?tab=sessions`, label: "Sessions" },
					{ label: shortId(invocationId) },
				]}
			/>

			{/* Header */}
			<div style={{ marginBottom: "24px" }}>
				<h1 style={{ color: "var(--ink)", fontSize: "20px", fontWeight: 500, margin: "0 0 6px" }}>
					Run {shortId(invocationId)}
				</h1>
				<div style={{ alignItems: "center", display: "flex", gap: "8px" }}>
					<Badge
						style={{
							background: "transparent",
							border: `1px solid ${statusColor}`,
							color: statusColor,
						}}
					>
						{invocationStatus}
					</Badge>
					{invocation.triggerType && <Badge variant="default">{invocation.triggerType}</Badge>}
				</div>
			</div>

			{/* Metadata card */}
			<div
				style={{
					background: "var(--surface-muted)",
					border: "1px solid var(--border)",
					borderRadius: "var(--radius)",
					marginBottom: "24px",
					padding: "0 16px",
				}}
			>
				<FieldRow label="Status">
					<span style={{ color: statusColor, fontWeight: 500 }}>{invocationStatus}</span>
				</FieldRow>

				{invocation.triggerType && <FieldRow label="Trigger">{invocation.triggerType}</FieldRow>}

				<FieldRow label="Version">v{invocation.automationVersion}</FieldRow>

				{invocation.startedAt && (
					<FieldRow label="Started">{new Date(invocation.startedAt).toLocaleString()}</FieldRow>
				)}

				{invocation.finishedAt && (
					<FieldRow label="Finished">{new Date(invocation.finishedAt).toLocaleString()}</FieldRow>
				)}

				<FieldRow label="Duration">
					{formatDuration(invocation.startedAt, invocation.finishedAt)}
				</FieldRow>

				{invocation.sessionId && (
					<FieldRow label="Session">
						<Link
							className="text-ink-muted no-underline hover:text-ink"
							href={`/sessions/${invocation.sessionId}`}
						>
							View session →
						</Link>
					</FieldRow>
				)}
			</div>

			{/* Error summary */}
			{invocation.errorSummary && (
				<div
					style={{
						background: "var(--danger-soft)",
						border: "1px solid var(--danger)",
						borderRadius: "var(--radius)",
						marginBottom: "24px",
						padding: "12px 16px",
					}}
				>
					<p
						style={{
							color: "var(--danger)",
							fontSize: "13px",
							fontWeight: 500,
							margin: "0 0 4px",
						}}
					>
						Error
					</p>
					<p style={{ color: "var(--ink)", fontSize: "13px", margin: 0 }}>
						{invocation.errorSummary}
					</p>
				</div>
			)}

			{/* Run summary */}
			{runSummary && (
				<div>
					<h2
						style={{
							color: "var(--ink-subtle)",
							fontSize: "11px",
							fontWeight: 500,
							letterSpacing: "0.04em",
							margin: "0 0 12px",
							textTransform: "uppercase",
						}}
					>
						Run summary
					</h2>
					<div
						style={{
							background: "var(--surface-muted)",
							border: "1px solid var(--border)",
							borderRadius: "var(--radius)",
							padding: "0 16px",
						}}
					>
						{runSummary.title && <FieldRow label="Title">{runSummary.title}</FieldRow>}

						{runSummary.preview && (
							<FieldRow label="Preview">
								<span
									style={{
										overflow: "hidden",
										display: "-webkit-box",
										WebkitBoxOrient: "vertical",
										WebkitLineClamp: 3,
									}}
								>
									{runSummary.preview}
								</span>
							</FieldRow>
						)}

						<FieldRow label="Tool calls">{runSummary.toolCallCount}</FieldRow>
						<FieldRow label="Approvals">{runSummary.approvalCount}</FieldRow>
						<FieldRow label="Artifacts">{runSummary.artifactCount}</FieldRow>

						{runSummary.errorSummary && (
							<FieldRow label="Error">
								<span style={{ color: "var(--danger)" }}>{runSummary.errorSummary}</span>
							</FieldRow>
						)}
					</div>
				</div>
			)}

			{/* Invocation events — the error envelope detail for failed runs
			    (screens.md §5 "Failed runs show the error envelope"). */}
			{events.length > 0 && (
				<div style={{ marginTop: "24px" }}>
					<h2
						style={{
							color: "var(--ink-subtle)",
							fontSize: "11px",
							fontWeight: 500,
							letterSpacing: "0.04em",
							margin: "0 0 12px",
							textTransform: "uppercase",
						}}
					>
						Events
					</h2>
					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						{events.map((event) => (
							<div
								key={event.id}
								style={{
									background: "var(--surface-muted)",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius)",
									padding: "10px 14px",
								}}
							>
								<div
									style={{
										alignItems: "baseline",
										display: "flex",
										flexWrap: "wrap",
										gap: "8px",
									}}
								>
									<span
										style={{
											color: EVENT_SEVERITY_COLOR[event.severity] ?? "var(--ink-subtle)",
											flexShrink: 0,
											fontSize: "11px",
											fontWeight: 500,
											textTransform: "uppercase",
										}}
									>
										{event.severity}
									</span>
									<span style={{ color: "var(--ink)", flex: 1, fontSize: "13px", fontWeight: 500 }}>
										{event.title}
									</span>
									<span
										className="font-mono"
										style={{ color: "var(--ink-subtle)", fontSize: "11px" }}
									>
										{event.eventType}
									</span>
									<span style={{ color: "var(--ink-subtle)", flexShrink: 0, fontSize: "11px" }}>
										{new Date(event.createdAt).toLocaleString()}
									</span>
								</div>
								{event.message && (
									<pre
										className="font-mono"
										style={{
											color: "var(--ink-muted)",
											fontSize: "11px",
											lineHeight: "1.6",
											margin: "6px 0 0",
											maxHeight: "200px",
											overflow: "auto",
											whiteSpace: "pre-wrap",
										}}
									>
										{event.message}
									</pre>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* The run's session view, embedded (screens.md §5: "run detail — the
			    run's session view + invocation metadata"). The fixed-height panel
			    gives SessionView's internal scroll regions a box to fill. */}
			{invocation.sessionId && (
				<div style={{ marginTop: "24px" }}>
					<div
						style={{
							alignItems: "baseline",
							display: "flex",
							gap: "8px",
							marginBottom: "12px",
						}}
					>
						<h2
							style={{
								color: "var(--ink-subtle)",
								flex: 1,
								fontSize: "11px",
								fontWeight: 500,
								letterSpacing: "0.04em",
								margin: 0,
								textTransform: "uppercase",
							}}
						>
							Session
						</h2>
						<Link
							className="text-ink-muted no-underline hover:text-ink"
							href={`/sessions/${invocation.sessionId}`}
							style={{ fontSize: "12px" }}
						>
							Open full view →
						</Link>
					</div>
					<div
						style={{
							border: "1px solid var(--border)",
							borderRadius: "var(--radius-lg)",
							height: "560px",
							overflow: "hidden",
						}}
					>
						<SessionView sessionId={invocation.sessionId} />
					</div>
				</div>
			)}
		</div>
	);
}
