import {
	runningToolLabel,
	shouldShowActivitySummary,
	type TranscriptTurn,
} from "@/lib/session-transcript";

// The single shimmering "thinking" line at the very bottom of an active turn,
// ported from mobile's ActivitySummaryLine. Shows the latest reasoning summary
// phrase, falling back to the running tool's label, then "On it" — a
// sub-second placeholder now that the server emits a preflight phrase from
// the user message. Summary-only and ephemeral: it renders ONLY while the
// turn is streaming reasoning/tool work — never while user-facing text is
// streaming in, and it leaves no trace once the turn completes.
export function ActivitySummaryLine({
	turn,
}: {
	turn: Pick<TranscriptTurn, "activity" | "parts" | "visibleTextStreaming">;
}) {
	if (!shouldShowActivitySummary(turn)) {
		return null;
	}

	const label = turn.activity.summary ?? runningToolLabel(turn.parts) ?? "On it";

	return (
		<div
			className="animate-[shimmer_1.5s_ease-in-out_infinite]"
			style={{
				color: "var(--ink-subtle)",
				fontSize: "15px",
				overflow: "hidden",
				padding: "2px 0",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			}}
		>
			{label}
		</div>
	);
}
