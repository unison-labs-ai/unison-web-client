"use client";

import { toolGroupMode, toolGroupTitle, visibleTools } from "@unison/client-core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { ToolPart } from "@/lib/session-transcript";
import { ToolCard } from "./tool-card";

// A run of consecutive tool calls, collapsed into one accordion (Claude-Cowork
// style). The header is a deterministic per-toolset title (never the agent-facing
// description). While the group is the live, streaming block it shows only the
// most-recent calls as a sliding window; once a later block arrives (or on
// reload) it collapses to the header. A manual expand is sticky and survives the
// auto-collapse. See docs/plans/2026-06-17-tool-call-streaming-visualization.md.
export function ToolGroup({ isActive, tools }: { isActive: boolean; tools: ToolPart[] }) {
	const [userExpanded, setUserExpanded] = useState(false);
	const mode = toolGroupMode({ isActive, userExpanded });
	const visible = visibleTools(tools, mode);
	const title = toolGroupTitle(tools.map((tool) => tool.tool));
	const running =
		isActive && tools.some((tool) => tool.status === "pending" || tool.status === "running");

	return (
		<div style={{ display: "flex", flexDirection: "column" }}>
			<button
				aria-expanded={userExpanded}
				className="hover:opacity-70"
				onClick={() => setUserExpanded((value) => !value)}
				style={{
					alignItems: "center",
					background: "transparent",
					border: "none",
					cursor: "pointer",
					display: "flex",
					gap: "6px",
					padding: "6px 0",
					textAlign: "left",
					width: "100%",
				}}
				type="button"
			>
				<span
					className={running ? "animate-[shimmer_1.5s_ease-in-out_infinite]" : undefined}
					style={{
						color: "var(--ink-muted)",
						flex: 1,
						fontSize: "15px",
						minWidth: 0,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{title}
				</span>
				{userExpanded ? (
					<ChevronDown size={14} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
				) : (
					<ChevronRight size={14} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
				)}
			</button>
			{visible.length > 0 ? (
				<div
					style={{
						borderLeft: "1px solid var(--border)",
						display: "flex",
						flexDirection: "column",
						marginLeft: "6px",
						paddingLeft: "8px",
					}}
				>
					{visible.map((tool) => (
						<ToolCard key={tool.callId} tool={tool} />
					))}
				</div>
			) : null}
		</div>
	);
}
