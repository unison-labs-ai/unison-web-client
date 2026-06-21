"use client";

import { useQuery } from "@tanstack/react-query";
import type { SessionTriggerReference, ThreadMessage } from "@unison/contracts";
import {
	CalendarDays,
	ChevronDown,
	ChevronRight,
	Clock,
	Globe2,
	Mail,
	Mic,
	Sparkles,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { triggerReferenceFromMessage } from "./trigger-reference";

function presentationFor(reference: SessionTriggerReference) {
	const eventType = reference.source?.eventType ?? "";

	if (eventType.startsWith("gmail")) {
		return { icon: Mail, label: "Via email" };
	}

	if (eventType.startsWith("calendar")) {
		return { icon: CalendarDays, label: "Calendar event" };
	}

	switch (reference.kind) {
		case "schedule":
			return { icon: Clock, label: "Scheduled run" };
		case "capture":
			return { icon: Mic, label: "Capture" };
		case "automation_call":
			return { icon: Sparkles, label: "Automation call" };
		case "manual_run":
			return { icon: Sparkles, label: "Manual run" };
		default:
			return { icon: Globe2, label: "Source event" };
	}
}

function formatWhen(value: string): string | null {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return null;

	return date.toLocaleString(undefined, {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
	});
}

function formatWhenFull(value: string): string | null {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return null;

	return date.toLocaleString(undefined, {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function TriggerReferenceCard({ message }: { message: ThreadMessage }) {
	const reference = triggerReferenceFromMessage(message);

	if (!reference) {
		return <AutomationRunInputCard content={message.content} />;
	}

	if (reference.source?.eventType?.startsWith("gmail")) {
		return <EmailTriggerCard reference={reference} />;
	}

	return <GenericTriggerCard reference={reference} />;
}

// ---------------------------------------------------------------------------
// Legacy automation-run message without a parseable reference: collapsed row
// that expands to the raw run input.
// ---------------------------------------------------------------------------

function AutomationRunInputCard({ content }: { content: string }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<button
			className="w-full rounded-md border border-(--border) bg-surface p-3 text-left hover:bg-primary-soft"
			onClick={() => setExpanded((current) => !current)}
			type="button"
		>
			<div className="flex items-center gap-3">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-muted">
					<Sparkles size={18} />
				</div>
				<div className="min-w-0 flex-1">
					<p className="m-0 text-ink-muted text-xs font-medium uppercase">Automation run</p>
					<p className="m-0 truncate text-ink-subtle text-sm">
						{expanded ? "Hide run input" : "Triggered automatically · show run input"}
					</p>
				</div>
			</div>
			{expanded ? (
				<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-[12px] text-ink-muted leading-[1.5]">
					{content}
				</pre>
			) : null}
		</button>
	);
}

// ---------------------------------------------------------------------------
// Email trigger: collapsed row shows subject + first line; expanding fetches
// the stored message and renders the full body.
// ---------------------------------------------------------------------------

function gmailMessageIdFrom(reference: SessionTriggerReference): string | null {
	const ids = reference.source?.externalIds ?? {};
	const direct = ids.gmailMessageId?.trim();

	if (direct) return direct;

	// Gmail source events use the message id as their external event id, with or
	// without a `gmail:` prefix depending on ingest era.
	const external = ids.externalEventId?.trim();

	if (!external) return null;

	return external.startsWith("gmail:") ? external.slice("gmail:".length) || null : external;
}

// The stored bodyMd is a synthesized document (`# subject`, `From:`, `## Preview`,
// `## Body`); only the body section is worth rendering here.
export function emailBodyFromBodyMd(bodyMd: string | null | undefined): string | null {
	if (!bodyMd) return null;

	const marker = "\n## Body\n";
	const index = bodyMd.indexOf(marker);

	if (index >= 0) {
		const body = bodyMd.slice(index + marker.length).trim();
		return body.length > 0 ? body : null;
	}

	// Older payloads stored a plain-text preview in bodyMd; a leading heading
	// means it is the synthesized document with an empty body section.
	const trimmed = bodyMd.trim();
	return trimmed.length === 0 || trimmed.startsWith("# ") ? null : trimmed;
}

function linkifyEmailText(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let cursor = 0;

	for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
		const start = match.index ?? 0;
		const url = match[0].replace(/[.,;:!?)\]]+$/, "");

		if (start > cursor) {
			nodes.push(text.slice(cursor, start));
		}

		nodes.push(
			<a
				className="break-all text-sky-foreground underline underline-offset-2"
				href={url}
				key={`${start}:${url}`}
				rel="noreferrer"
				target="_blank"
			>
				{url}
			</a>,
		);
		cursor = start + url.length;
	}

	if (cursor < text.length) {
		nodes.push(text.slice(cursor));
	}

	return nodes;
}

function EmailBodyText({ text }: { text: string }) {
	const paragraphs = text
		.replace(/\r\n/g, "\n")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0);

	if (paragraphs.length === 0) return null;

	return (
		<div className="flex flex-col gap-3">
			{paragraphs.map((paragraph, index) => {
				const key = `${index}:${paragraph.slice(0, 24)}`;

				if (paragraph.startsWith(">")) {
					const quoted = paragraph
						.split("\n")
						.map((line) => line.replace(/^>\s?/, ""))
						.join("\n");

					return (
						<blockquote
							className="m-0 whitespace-pre-wrap break-words border-(--border) border-l pl-3 text-ink-muted text-sm leading-[1.55]"
							key={key}
						>
							{linkifyEmailText(quoted)}
						</blockquote>
					);
				}

				return (
					<p
						className="m-0 whitespace-pre-wrap break-words text-ink text-sm leading-[1.55]"
						key={key}
					>
						{linkifyEmailText(paragraph)}
					</p>
				);
			})}
		</div>
	);
}

function EmailTriggerCard({ reference }: { reference: SessionTriggerReference }) {
	const api = useApi();
	const [expanded, setExpanded] = useState(false);
	const gmailMessageId = gmailMessageIdFrom(reference);

	const { data: message, isLoading } = useQuery({
		enabled: expanded && gmailMessageId !== null,
		queryFn: () => api.getGmailMessage(gmailMessageId as string),
		queryKey: ["gmail-message", gmailMessageId],
		// A missing message (purged source event) is an expected fallback path,
		// not a transient failure — don't sit in retries before showing the snippet.
		retry: (failureCount, error) =>
			failureCount < 2 &&
			!(error instanceof WebApiError && error.status >= 400 && error.status < 500),
		staleTime: 300_000,
	});

	const when = formatWhen(reference.occurredAt);
	const subject = message?.subject ?? reference.display.title;
	const previewLine = reference.display.snippet?.split("\n")[0]?.trim();
	const from = message?.from ?? reference.display.actor;
	const fullWhen = formatWhenFull(message?.receivedAt ?? reference.occurredAt);
	const body =
		emailBodyFromBodyMd(message?.bodyMd) ??
		message?.bodyPreview ??
		reference.display.snippet ??
		null;
	const loading = expanded && gmailMessageId !== null && isLoading;

	return (
		<div className="overflow-hidden rounded-md border border-(--border) bg-surface">
			<button
				aria-expanded={expanded}
				className="w-full p-3 text-left hover:bg-primary-soft"
				onClick={() => setExpanded((current) => !current)}
				type="button"
			>
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-muted">
						<Mail size={18} />
					</div>
					<div className="min-w-0 flex-1">
						<p className="m-0 text-ink-muted text-xs font-medium uppercase">
							{["Via email", when].filter(Boolean).join(" · ")}
						</p>
						{subject ? (
							<p className="m-0 truncate text-[15px] text-ink leading-[1.4]">{subject}</p>
						) : null}
						{!expanded && previewLine ? (
							<p className="m-0 truncate text-ink-subtle text-sm">{previewLine}</p>
						) : null}
					</div>
					<span className="shrink-0 text-ink-subtle">
						{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
					</span>
				</div>
			</button>
			{expanded ? (
				<div className="border-(--border) border-t px-3 py-3">
					{from || fullWhen ? (
						<p className="m-0 mb-3 text-ink-muted text-sm">
							{from ? (
								<>
									From <span className="text-ink">{from}</span>
								</>
							) : null}
							{from && fullWhen ? " · " : null}
							{fullWhen}
						</p>
					) : null}
					{loading ? (
						<p className="m-0 animate-[shimmer_1.5s_ease-in-out_infinite] text-ink-subtle text-sm">
							Loading email…
						</p>
					) : body ? (
						<div className="max-h-[480px] overflow-y-auto">
							<EmailBodyText text={body} />
						</div>
					) : (
						<p className="m-0 text-ink-subtle text-sm">The full email isn’t available.</p>
					)}
				</div>
			) : null}
		</div>
	);
}

// ---------------------------------------------------------------------------
// All other trigger sources: static reference card.
// ---------------------------------------------------------------------------

function GenericTriggerCard({ reference }: { reference: SessionTriggerReference }) {
	const { icon: Icon, label } = presentationFor(reference);
	const when = formatWhen(reference.occurredAt);

	return (
		<div className="rounded-md border border-(--border) bg-surface p-3">
			<div className="flex items-center gap-3">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-muted">
					<Icon size={18} />
				</div>
				<div className="min-w-0 flex-1">
					<p className="m-0 text-ink-muted text-xs font-medium uppercase">
						{[label, when].filter(Boolean).join(" · ")}
					</p>
					{reference.display.title ? (
						<p className="m-0 line-clamp-2 text-[15px] text-ink leading-[1.4]">
							{reference.display.title}
						</p>
					) : null}
					{reference.display.actor ? (
						<p className="m-0 truncate text-ink-muted text-sm">{reference.display.actor}</p>
					) : null}
				</div>
			</div>
			{reference.display.snippet ? (
				<p className="mt-3 mb-0 line-clamp-3 text-ink-muted text-sm leading-[1.45]">
					{reference.display.snippet}
				</p>
			) : null}
		</div>
	);
}
