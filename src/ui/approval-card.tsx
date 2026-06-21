"use client";

import type { AgentToolApproval, AgentToolApprovalDecisionRequest } from "@unison/contracts";
import {
	AlarmClock,
	Calendar,
	Code2,
	FileText,
	FolderOpen,
	Globe,
	type LucideIcon,
	Mail,
	Mic,
	Sparkles,
	SquareKanban,
	Table,
	Users,
	Wrench,
	X,
	Zap,
} from "lucide-react";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { cn } from "@/ui/utils";

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

// Generic verbs that read as bare actions on their own ("Create", "Run") — when
// the tool's last segment is one of these we prefix the domain so the title
// stays legible ("Create automation", "Run code").
const BARE_VERBS = new Set([
	"create",
	"update",
	"delete",
	"remove",
	"get",
	"list",
	"run",
	"test",
	"send",
	"set",
	"enable",
	"disable",
	"search",
	"add",
	"archive",
]);

const WRAPPER_SEGMENTS = new Set(["connector", "google"]);

function splitWords(segment: string): string {
	return segment
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[._-]+/g, " ")
		.trim()
		.toLowerCase();
}

function sentenceCase(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "connector.google.calendar.createEvent" → "Create event"; "automation.create"
 *  → "Create automation"; "code.run" → "Run code". */
function humanizeToolTitle(toolName: string): string {
	const segments = toolName.split(".").filter(Boolean);
	const last = segments.at(-1) ?? toolName;
	const words = splitWords(last);
	const firstWord = words.split(" ")[0] ?? "";

	if (BARE_VERBS.has(firstWord) && !words.includes(" ")) {
		const domain = [...segments.slice(0, -1)]
			.reverse()
			.find((segment) => !WRAPPER_SEGMENTS.has(segment));
		if (domain) {
			return sentenceCase(`${words} ${splitWords(domain)}`);
		}
	}

	return sentenceCase(words);
}

function humanizeKey(key: string): string {
	return sentenceCase(splitWords(key)) || key;
}

const TOOL_ICONS: Array<{ icon: LucideIcon; match: RegExp }> = [
	{ icon: Calendar, match: /calendar|event/ },
	{ icon: Mail, match: /gmail|email|mail|draft/ },
	{ icon: AlarmClock, match: /remind/ },
	{ icon: Table, match: /sheet/ },
	{ icon: FileText, match: /doc|document|report|artifact|note/ },
	{ icon: FolderOpen, match: /drive|file/ },
	{ icon: Users, match: /people|contact|person/ },
	{ icon: SquareKanban, match: /linear|issue|project/ },
	{ icon: Code2, match: /code|sandbox/ },
	{ icon: Zap, match: /automation/ },
	{ icon: Sparkles, match: /brain|memory/ },
	{ icon: Mic, match: /capture|meeting|granola|transcript/ },
	{ icon: Globe, match: /web|search|http/ },
];

function toolIcon(toolName: string): LucideIcon {
	const haystack = toolName.toLowerCase();
	return TOOL_ICONS.find(({ match }) => match.test(haystack))?.icon ?? Wrench;
}

type Detail = { block: boolean; href?: string; key: string; label: string; value: string };

const URL_RE = /^https?:\/\/\S+$/i;

function buildDetails(input: Record<string, unknown>): Detail[] {
	const details: Detail[] = [];

	for (const [key, raw] of Object.entries(input)) {
		if (raw === null || raw === undefined || raw === "") continue;

		let value: string;
		let block = false;
		let href: string | undefined;

		if (typeof raw === "string") {
			value = raw.trim();
			if (!value) continue;
			block = value.length > 72 || value.includes("\n");
			if (URL_RE.test(value)) href = value;
		} else if (typeof raw === "number" || typeof raw === "boolean") {
			value = String(raw);
		} else if (Array.isArray(raw)) {
			if (raw.length === 0) continue;
			if (raw.every((item) => typeof item === "string" || typeof item === "number")) {
				value = raw.join(", ");
				block = value.length > 72;
			} else {
				value = JSON.stringify(raw, null, 2);
				block = true;
			}
		} else if (typeof raw === "object") {
			value = JSON.stringify(raw, null, 2);
			block = true;
		} else {
			continue;
		}

		details.push({ block, href, key, label: humanizeKey(key), value });
	}

	return details;
}

type ApprovalCardProps = {
	approval: AgentToolApproval;
	compact?: boolean;
	onDecide?: (request: AgentToolApprovalDecisionRequest) => void;
	/** History/audit rendering: hide the action buttons even when the approval
	 *  is pending; the status badge stands in for them. Omitting `onDecide`
	 *  has the same effect. */
	readOnly?: boolean;
};

/**
 * The single approval surface, reused everywhere a tool call needs a human OK —
 * inline in a session, on the Approvals page, and in the audit history. It reads
 * as a plain request ("Create event", the agent's reasoning, the details) rather
 * than a raw argument dump, and the actions map 1:1 to what the backend supports:
 * Allow once (approve), Always allow (durable per-tool grant via `escalate`, only
 * when the tool permits it), and Reject.
 */
export function ApprovalCard({
	approval,
	compact = false,
	onDecide,
	readOnly = false,
}: ApprovalCardProps) {
	const details = buildDetails(approval.input);
	// Outbound-delivery + fixed-policy tools can never be "always allowed" (hard
	// floors in the resolver) — the backend rejects the escalation, so don't offer
	// it. See assertApprovalEscalationAllowed in services/api.
	const canEscalate =
		approval.metadata.fixedTool !== true && approval.metadata.outboundDelivery !== true;
	const interactive = !readOnly && approval.status === "pending" && Boolean(onDecide);
	const Icon = toolIcon(approval.toolName);

	return (
		<div
			className={cn(
				"rounded-lg border border-(--border) bg-surface-muted",
				compact ? "p-3" : "p-4",
			)}
		>
			{/* Header: tool glyph + plain-language action, with a status badge in
			    read-only/history views. */}
			<div className="flex items-start gap-3">
				<span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface text-ink-muted">
					<Icon size={18} strokeWidth={1.75} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center justify-between gap-2">
						<p className="m-0 truncate font-medium text-ink text-sm">
							{humanizeToolTitle(approval.toolName)}
						</p>
						{!interactive ? (
							<Badge variant={statusVariant(approval.status)}>{statusLabel(approval.status)}</Badge>
						) : null}
					</div>
					{approval.requestedReason ? (
						<p className="m-0 mt-0.5 text-ink-muted text-sm italic">{approval.requestedReason}</p>
					) : null}
				</div>
			</div>

			{/* Details: humanized key/value rows; long text & objects drop to their
			    own block instead of spilling across the row. */}
			{details.length > 0 ? (
				<dl className="mt-3 mb-0 overflow-hidden rounded-md border border-(--line) bg-surface/40">
					{details.map((detail) =>
						detail.block ? (
							<div className="border-t border-(--line) px-3 py-2 first:border-t-0" key={detail.key}>
								<dt className="text-[11px] text-ink-subtle uppercase tracking-wide">
									{detail.label}
								</dt>
								<dd className="m-0 mt-1 whitespace-pre-wrap break-words text-ink-muted text-sm">
									{detail.href ? (
										<a
											className="text-sky-foreground underline underline-offset-2 hover:opacity-80"
											href={detail.href}
											rel="noreferrer"
											target="_blank"
										>
											{detail.value}
										</a>
									) : (
										detail.value
									)}
								</dd>
							</div>
						) : (
							<div
								className="flex gap-3 border-t border-(--line) px-3 py-1.5 first:border-t-0"
								key={detail.key}
							>
								<dt className="w-24 shrink-0 text-ink-subtle text-sm">{detail.label}</dt>
								<dd className="m-0 min-w-0 break-words text-ink text-sm">
									{detail.href ? (
										<a
											className="text-sky-foreground underline underline-offset-2 hover:opacity-80"
											href={detail.href}
											rel="noreferrer"
											target="_blank"
										>
											{detail.value}
										</a>
									) : (
										detail.value
									)}
								</dd>
							</div>
						),
					)}
				</dl>
			) : null}

			{/* Actions / status footer */}
			{interactive && onDecide ? (
				<div className="mt-4 flex items-center justify-between gap-2">
					<Button
						className="text-ink-subtle hover:text-danger"
						onClick={() => onDecide({ decision: "reject" })}
						size="sm"
						variant="ghost"
					>
						<X size={14} />
						Reject
					</Button>
					<div className="flex items-center gap-2">
						<Button onClick={() => onDecide({ decision: "approve" })} size="sm" variant="default">
							Allow once
						</Button>
						{canEscalate ? (
							<Button
								onClick={() => onDecide({ decision: "approve", escalate: "always_allow" })}
								size="sm"
								title="Always allow this tool — saved to your permissions and applied in every session."
								variant="secondary"
							>
								Always allow
							</Button>
						) : null}
					</div>
				</div>
			) : approval.decidedAt ? (
				<p className="m-0 mt-3 text-[11px] text-ink-subtle">
					{statusLabel(approval.status)} · {formatDate(approval.decidedAt)}
				</p>
			) : null}
		</div>
	);
}
