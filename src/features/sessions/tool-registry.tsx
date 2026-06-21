import type { LucideIcon } from "lucide-react";
import {
	Bell,
	CalendarDays,
	FileText,
	Globe2,
	Mail,
	Search,
	Tag,
	Users,
	Wrench,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import {
	formatDisplayValue,
	listValue,
	recordValue,
	stringListValue,
	stringValue,
	type ToolPart,
	toolPresentation,
} from "@/lib/session-transcript";

// Two-level render dispatch, a 1:1 port of mobile's tool registry
// (clients/mobile/src/features/chat/tool-registry.tsx): the card hands a tool
// part to this registry, keyed by tool name → presentation (icon + human label
// + a rich body), with a generic fallback. The collapsed row stays deliberately
// clean — a past-tense action phrase only; all args/results live in the
// expanded body. Labels/icons/defaultOpen come from the shared lib map so the
// activity line and the cards never disagree.

export type ToolCardPresentation = {
	body: (tool: ToolPart) => ReactNode;
	defaultOpen: boolean;
	Icon: LucideIcon;
	label: string;
};

const ICONS: Record<string, LucideIcon> = {
	bell: Bell,
	calendar: CalendarDays,
	file: FileText,
	globe: Globe2,
	mail: Mail,
	people: Users,
	search: Search,
	tag: Tag,
	tool: Wrench,
};

// ── body atoms ──────────────────────────────────────────────────────────────

function clampLines(lines: number | undefined): CSSProperties {
	if (!lines) {
		return {};
	}

	return {
		display: "-webkit-box",
		overflow: "hidden",
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: lines,
	};
}

function Field({ label, lines, value }: { label: string; lines?: number; value: string }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
			<span
				style={{
					color: "var(--ink-subtle)",
					fontSize: "11px",
					fontWeight: 500,
					textTransform: "uppercase",
				}}
			>
				{label}
			</span>
			<span
				style={{
					color: "var(--ink-muted)",
					fontSize: "14px",
					lineHeight: "20px",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					...clampLines(lines),
				}}
			>
				{value}
			</span>
		</div>
	);
}

function StatusBadge({ tool }: { tool: ToolPart }) {
	const failed = tool.status === "error";
	const pending = tool.status === "pending";

	return (
		<span
			style={{
				alignSelf: "flex-start",
				background: failed
					? "var(--danger-soft)"
					: pending
						? "var(--warning-soft)"
						: "var(--positive-soft)",
				borderRadius: "var(--radius-pill)",
				color: failed ? "var(--danger)" : pending ? "var(--warning)" : "var(--positive)",
				fontSize: "11px",
				fontWeight: 500,
				padding: "2px 8px",
				textTransform: "uppercase",
			}}
		>
			{failed ? "Failed" : pending ? "Pending approval" : "Completed"}
		</span>
	);
}

function ResultRow({
	snippet,
	subtitle,
	title,
}: {
	snippet?: string;
	subtitle?: string;
	title: string;
}) {
	const oneLine: CSSProperties = {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	};

	return (
		<div
			style={{
				borderBottom: "1px solid var(--line)",
				display: "flex",
				flexDirection: "column",
				gap: "2px",
				padding: "8px",
			}}
		>
			<span style={{ color: "var(--ink)", fontSize: "14px", fontWeight: 500, ...oneLine }}>
				{title}
			</span>
			{subtitle ? (
				<span style={{ color: "var(--ink-subtle)", fontSize: "12px", ...oneLine }}>{subtitle}</span>
			) : null}
			{snippet ? (
				<span
					style={{
						color: "var(--ink-subtle)",
						fontSize: "13px",
						lineHeight: "18px",
						...clampLines(2),
					}}
				>
					{snippet}
				</span>
			) : null}
		</div>
	);
}

function ResultList({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				border: "1px solid var(--border)",
				borderRadius: "var(--radius-md)",
				overflow: "hidden",
			}}
		>
			{children}
		</div>
	);
}

function Body({ children }: { children: ReactNode }) {
	return <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{children}</div>;
}

function Divider() {
	return <div style={{ background: "var(--border)", height: "1px" }} />;
}

function ErrorBody({ tool }: { tool: ToolPart }) {
	if (!tool.errorText) {
		return <StatusBadge tool={tool} />;
	}

	return (
		<Body>
			<StatusBadge tool={tool} />
			<Field label="Error" lines={6} value={tool.errorText} />
		</Body>
	);
}

// The generic fallback body: a clean key/value view of the salient args, then a
// short result. Values are line-capped so a big payload can't blow out the card.
function GenericBody({ tool }: { tool: ToolPart }) {
	if (tool.status === "error") {
		return <ErrorBody tool={tool} />;
	}

	const input = recordValue(tool.input);
	const output = recordValue(tool.output);
	const inputKeys = input ? Object.keys(input).slice(0, 6) : [];
	const outputKeys = output ? Object.keys(output).slice(0, 6) : [];

	return (
		<Body>
			{inputKeys.map((key) => (
				<Field key={`in:${key}`} label={key} lines={3} value={formatDisplayValue(input?.[key])} />
			))}
			{outputKeys.length > 0 ? <Divider /> : null}
			{outputKeys.map((key) => (
				<Field key={`out:${key}`} label={key} lines={6} value={formatDisplayValue(output?.[key])} />
			))}
			{inputKeys.length === 0 && outputKeys.length === 0 ? <StatusBadge tool={tool} /> : null}
		</Body>
	);
}

// ── per-tool bodies ─────────────────────────────────────────────────────────

function WebSearchBody({ tool }: { tool: ToolPart }) {
	if (tool.status === "error") {
		return <ErrorBody tool={tool} />;
	}

	const query = stringValue(recordValue(tool.input), "query");
	const results = listValue(recordValue(tool.output), "results");

	if (results.length === 0) {
		return (
			<Body>
				{query ? <Field label="Query" value={query} /> : null}
				<span style={{ color: "var(--ink-subtle)", fontSize: "14px" }}>No results.</span>
			</Body>
		);
	}

	return (
		<Body>
			{query ? <Field label="Query" value={query} /> : null}
			<span
				style={{
					color: "var(--ink-subtle)",
					fontSize: "11px",
					fontWeight: 500,
					textTransform: "uppercase",
				}}
			>
				{results.length === 1 ? "1 result" : `${results.length} results`}
			</span>
			<ResultList>
				{results.slice(0, 8).map((entry) => {
					const row = recordValue(entry);
					const title = stringValue(row, "title") ?? stringValue(row, "url") ?? "Result";
					const key = stringValue(row, "url") ?? stringValue(row, "display_url") ?? title;

					return (
						<ResultRow
							key={key}
							snippet={stringValue(row, "description")}
							subtitle={stringValue(row, "display_url") ?? stringValue(row, "url")}
							title={title}
						/>
					);
				})}
			</ResultList>
		</Body>
	);
}

function EmailBody({ tool }: { tool: ToolPart }) {
	if (tool.status === "error") {
		return <ErrorBody tool={tool} />;
	}

	const message = recordValue(recordValue(tool.output)?.message) ?? recordValue(tool.output);
	const subject = stringValue(message, "subject");
	const from = stringValue(message, "from") ?? stringValue(message, "sender");
	const snippet = stringValue(message, "snippet") ?? stringValue(message, "preview");

	if (!subject && !from && !snippet) {
		return <GenericBody tool={tool} />;
	}

	return (
		<Body>
			<ResultList>
				<ResultRow snippet={snippet} subtitle={subject} title={from ?? subject ?? "Email"} />
			</ResultList>
		</Body>
	);
}

function DraftBody({ tool }: { tool: ToolPart }) {
	if (tool.status === "error") {
		return <ErrorBody tool={tool} />;
	}

	const input = recordValue(tool.input);
	const recipients = [
		stringValue(input, "to"),
		...stringListValue(input, "cc"),
		...stringListValue(input, "bcc"),
	].filter((item): item is string => Boolean(item));
	const subject = stringValue(input, "subject");
	const body = stringValue(input, "body");

	return (
		<Body>
			{recipients.length > 0 ? (
				<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
					<span
						style={{
							color: "var(--ink-subtle)",
							fontSize: "11px",
							fontWeight: 500,
							textTransform: "uppercase",
						}}
					>
						To
					</span>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
						{recipients.map((recipient) => (
							<span
								key={recipient}
								style={{
									background: "var(--surface)",
									borderRadius: "var(--radius-pill)",
									color: "var(--ink-muted)",
									fontSize: "12px",
									padding: "2px 8px",
								}}
							>
								{recipient}
							</span>
						))}
					</div>
				</div>
			) : null}
			{subject ? <Field label="Subject" value={subject} /> : null}
			{body ? (
				<>
					<Divider />
					<span
						style={{
							color: "var(--ink-muted)",
							fontSize: "14px",
							lineHeight: "20px",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							...clampLines(8),
						}}
					>
						{body}
					</span>
				</>
			) : null}
		</Body>
	);
}

// ── registry ────────────────────────────────────────────────────────────────

const BODIES: Record<string, (tool: ToolPart) => ReactNode> = {
	"connector.google.gmail.createDraft": (tool) => <DraftBody tool={tool} />,
	"connector.google.gmail.getMessage": (tool) => <EmailBody tool={tool} />,
	"email.draft.create": (tool) => <DraftBody tool={tool} />,
	"email.draft.update": (tool) => <DraftBody tool={tool} />,
	"web.search": (tool) => <WebSearchBody tool={tool} />,
};

export function toolCardPresentation(name: string): ToolCardPresentation {
	const base = toolPresentation(name);
	const body = BODIES[name] ?? ((tool: ToolPart) => <GenericBody tool={tool} />);

	return {
		body,
		defaultOpen: base.defaultOpen,
		Icon: ICONS[base.icon] ?? Wrench,
		label: base.label,
	};
}
