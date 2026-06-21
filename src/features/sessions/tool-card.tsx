"use client";

import { toolRowLabel } from "@unison/client-core";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

import { summarizeToolResult, type ToolPart } from "@/lib/session-transcript";
import { toolCardPresentation } from "./tool-registry";

// A tool call rendered as a Town-style card, a 1:1 port of mobile's ToolCard
// (clients/mobile/src/features/chat/components/tool-card.tsx): a clean
// collapsed header row (icon + past-tense label + status/count) that clicks to
// reveal a per-tool body with the args/results. While the tool runs the title
// shimmers and a spinner shows; the row can't be toggled until it completes.
export function ToolCard({ tool }: { tool: ToolPart }) {
	const presentation = toolCardPresentation(tool.tool);
	const running = tool.status === "pending" || tool.status === "running";
	const [open, setOpen] = useState(presentation.defaultOpen);
	const count = summarizeToolResult(tool);
	const showBody = open && !running;
	const raised = running || showBody;
	const { Icon } = presentation;

	return (
		<div
			style={{
				background: raised ? "var(--surface-muted)" : "transparent",
				borderRadius: "var(--radius-md)",
				overflow: "hidden",
			}}
		>
			<button
				aria-expanded={showBody}
				className={running ? undefined : "hover:opacity-70"}
				disabled={running}
				onClick={() => {
					if (!running) setOpen((value) => !value);
				}}
				style={{
					alignItems: "center",
					background: "transparent",
					border: "none",
					cursor: running ? "default" : "pointer",
					display: "flex",
					gap: "10px",
					padding: "6px 10px",
					textAlign: "left",
					width: "100%",
				}}
				type="button"
			>
				<Icon size={14} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
				<span
					className={running ? "animate-[shimmer_1.5s_ease-in-out_infinite]" : undefined}
					style={{
						color: "var(--ink-muted)",
						flex: 1,
						fontSize: "14px",
						minWidth: 0,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{toolRowLabel(tool.tool)}
				</span>
				{running ? (
					<Loader2
						className="animate-spin"
						size={14}
						style={{ color: "var(--ink-subtle)", flexShrink: 0 }}
					/>
				) : (
					<span style={{ alignItems: "center", display: "flex", flexShrink: 0, gap: "6px" }}>
						{count ? (
							<span
								style={{
									color: tool.status === "error" ? "var(--danger)" : "var(--ink-subtle)",
									fontSize: "12px",
								}}
							>
								{count}
							</span>
						) : null}
						{open ? (
							<ChevronDown size={14} style={{ color: "var(--ink-subtle)" }} />
						) : (
							<ChevronRight size={14} style={{ color: "var(--ink-subtle)" }} />
						)}
					</span>
				)}
			</button>
			{showBody ? (
				<div style={{ padding: "6px 14px 14px 28px" }}>{presentation.body(tool)}</div>
			) : null}
		</div>
	);
}
