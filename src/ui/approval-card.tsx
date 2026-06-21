"use client";

import type { AgentToolApproval } from "@unison/contracts";
import Link from "next/link";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";

type StatusVariant = "default" | "positive" | "danger" | "warning";

function statusVariant(status: AgentToolApproval["status"]): StatusVariant {
	switch (status) {
		case "approved":
			return "positive";
		case "rejected":
		case "cancelled":
			return "danger";
		case "pending":
			return "warning";
		default:
			return "default";
	}
}

function statusLabel(status: AgentToolApproval["status"]): string {
	switch (status) {
		case "approved":
			return "Approved";
		case "rejected":
			return "Denied";
		case "cancelled":
			return "Cancelled";
		case "pending":
			return "Pending";
		case "expired":
			return "Expired";
	}
}

function formatDate(iso: string | null): string {
	if (!iso) return "";
	return new Date(iso).toLocaleString();
}

type ApprovalCardProps = {
	approval: AgentToolApproval;
	compact?: boolean;
	onDecide?: (decision: "approve" | "reject") => void;
	/** History/audit rendering: hide the action buttons even when the approval
	 *  is pending; the status badge stands in for them. Omitting `onDecide`
	 *  has the same effect. */
	readOnly?: boolean;
};

export function ApprovalCard({
	approval,
	compact = false,
	onDecide,
	readOnly = false,
}: ApprovalCardProps) {
	const inputEntries = Object.entries(approval.input);

	return (
		// Inline cards are layer-1 panels: surface-muted fill (layout.md §2).
		<div
			style={{
				background: "var(--surface-muted)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius)",
				padding: compact ? "12px" : "16px",
			}}
		>
			{/* Header row: tool name + status */}
			<div
				style={{
					alignItems: "center",
					display: "flex",
					gap: "8px",
					justifyContent: "space-between",
					marginBottom: "10px",
				}}
			>
				<span
					style={{
						color: "var(--ink)",
						fontFamily: "var(--font-mono)",
						fontSize: "13px",
						fontWeight: 500,
					}}
				>
					{approval.toolName}
				</span>
				<Badge variant={statusVariant(approval.status)}>{statusLabel(approval.status)}</Badge>
			</div>

			{/* Input arguments */}
			{inputEntries.length > 0 && (
				<div style={{ marginBottom: "10px" }}>
					<p
						className="type-small"
						style={{
							color: "var(--ink-subtle)",
							marginBottom: "4px",
							marginTop: 0,
							textTransform: "uppercase",
						}}
					>
						Arguments
					</p>
					{/* Steps up the surface scale from the card's muted fill. */}
					<div
						style={{
							background: "var(--surface)",
							borderRadius: "var(--radius-sm)",
							fontSize: "12px",
							padding: "8px 10px",
						}}
					>
						{inputEntries.map(([key, value]) => (
							<div
								key={key}
								style={{
									display: "flex",
									gap: "8px",
									marginBottom: "2px",
								}}
							>
								<span style={{ color: "var(--ink-subtle)", flexShrink: 0, fontWeight: 500 }}>
									{key}:
								</span>
								<span
									style={{
										color: "var(--ink)",
										fontFamily: "var(--font-mono)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: compact ? "nowrap" : "pre-wrap",
										wordBreak: "break-all",
									}}
								>
									{typeof value === "string" ? value : JSON.stringify(value)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Requested reason */}
			{approval.requestedReason && (
				<div style={{ marginBottom: "10px" }}>
					<p
						className="type-small"
						style={{
							color: "var(--ink-subtle)",
							marginBottom: "4px",
							marginTop: 0,
							textTransform: "uppercase",
						}}
					>
						Why
					</p>
					<p
						style={{
							color: "var(--ink-muted)",
							fontSize: "13px",
							fontStyle: "italic",
							margin: 0,
						}}
					>
						&ldquo;{approval.requestedReason}&rdquo;
					</p>
				</div>
			)}

			{/* Footer: session link + decidedAt / action buttons */}
			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexWrap: "wrap",
					gap: "8px",
					justifyContent: "space-between",
					marginTop: "12px",
				}}
			>
				<Link
					href={`/sessions/${approval.sessionId}`}
					style={{
						color: "var(--sky-foreground)",
						fontSize: "12px",
						textDecoration: "none",
					}}
				>
					Session: {approval.sessionId.slice(0, 8)}&hellip;
				</Link>

				{!readOnly && approval.status === "pending" && onDecide ? (
					<div style={{ display: "flex", gap: "6px" }}>
						<Button onClick={() => onDecide("reject")} size="sm" variant="destructive">
							Deny
						</Button>
						<Button onClick={() => onDecide("approve")} size="sm" variant="default">
							Approve
						</Button>
					</div>
				) : approval.decidedAt ? (
					<span style={{ color: "var(--ink-subtle)", fontSize: "12px" }}>
						{statusLabel(approval.status)} {formatDate(approval.decidedAt)}
					</span>
				) : null}
			</div>
		</div>
	);
}
