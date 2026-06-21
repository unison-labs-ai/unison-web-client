import { groupParts } from "@unison/client-core";
import type { ThreadMessageStreamEvent } from "@unison/contracts";

import type { TranscriptTurn } from "@/lib/session-transcript";
import { ActivitySummaryLine } from "./activity-summary-line";
import { AssistantMarkdown } from "./assistant-markdown";
import { MessageBubble } from "./message-bubble";
import { ArtifactChip } from "./modules/artifact-chip";
import { isModuleTool } from "./modules/registry";
import { ToolGroup } from "./tool-group";

/** Rendered below the transcript when a turn ends abnormally. */
export type TurnNotice = {
	kind: "cancelled" | "error" | "failed";
	message?: string;
};

/** Derive the abnormal-ending notice from a terminal stream event (null clears it). */
export function noticeFromStreamEvent(event: ThreadMessageStreamEvent): TurnNotice | null {
	if (event.type === "session.completed") {
		if (event.status === "failed") {
			return { kind: "failed" };
		}

		if (event.status === "cancelled") {
			return { kind: "cancelled" };
		}

		return null;
	}

	if (event.type === "error") {
		return { kind: "error", message: event.message };
	}

	return null;
}

// The conversation surface, a 1:1 port of mobile's chat-screen turn loop: each
// turn renders its user bubble (or trigger card), then the chronologically
// ordered text/tool parts, then the ephemeral activity line at the bottom.
// Tool cards come from the live turn runtime and stay visible after the turn
// completes; input requests render through the approvals query, not here.
export function Transcript({ turns }: { turns: TranscriptTurn[] }) {
	if (turns.length === 0) {
		return (
			<div
				style={{
					alignItems: "center",
					color: "var(--ink-subtle)",
					display: "flex",
					fontSize: "14px",
					height: "120px",
					justifyContent: "center",
				}}
			>
				No messages yet.
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px 0 32px" }}>
			{turns.map((turn) => {
				// Fold the chronological parts into blocks: runs of consecutive tool
				// calls become one collapsible group; module tools (drafts/artifacts)
				// flush out as their own chips. The reasoning/activity line shows only
				// while the turn isn't ending on a live tool group (whose own header
				// carries the streaming state).
				const blocks = groupParts(turn.parts, {
					isStandalone: (part) => part.kind === "tool" && isModuleTool(part.tool.tool),
				});
				const lastIsToolGroup = blocks[blocks.length - 1]?.kind === "tools";

				return (
					<div key={turn.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
						{turn.userMessage ? <MessageBubble message={turn.userMessage} /> : null}
						{turn.looseMessages.map((message) =>
							message.content.length > 0 ? (
								<MessageBubble key={message.id} message={message} />
							) : null,
						)}
						{blocks.map((block, index) => {
							if (block.kind === "text") {
								return block.part.kind === "text" ? (
									<div key={block.part.id} style={{ margin: "2px 0" }}>
										<AssistantMarkdown text={block.part.text} />
									</div>
								) : null;
							}

							if (block.kind === "tools") {
								const tools = block.tools.flatMap((part) =>
									part.kind === "tool" ? [part.tool] : [],
								);
								return (
									<ToolGroup
										key={block.groupId}
										isActive={turn.activity.streaming && index === blocks.length - 1}
										tools={tools}
									/>
								);
							}

							// "other" block: a standalone module tool renders its artifact
							// chip; input-request parts pause the turn and render from the
							// approvals query in the session view, not here.
							return block.part.kind === "tool" ? (
								<ArtifactChip key={block.part.id} toolPart={block.part.tool} />
							) : null;
						})}
						{lastIsToolGroup ? null : <ActivitySummaryLine turn={turn} />}
					</div>
				);
			})}
		</div>
	);
}
