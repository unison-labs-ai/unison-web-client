import type { ThreadMessage } from "@unison/contracts";
import { Paperclip, Zap } from "lucide-react";

import { AssistantMarkdown } from "./assistant-markdown";
import { isTriggerMessage } from "./trigger-reference";
import { TriggerReferenceCard } from "./trigger-reference-card";

type MessageBubbleProps = {
	message: ThreadMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
	if (isTriggerMessage(message)) {
		return (
			<div style={{ display: "flex", justifyContent: "flex-start", margin: "10px 0" }}>
				<div style={{ maxWidth: "680px", width: "100%" }}>
					<TriggerReferenceCard message={message} />
				</div>
			</div>
		);
	}

	const isUser = message.role === "user";

	// A just-admitted turn's assistant placeholder (status "streaming", no
	// content yet) renders as the same shimmer the pending bubble uses, so the
	// turn reads as "thinking" instead of an invisible empty row.
	if (!isUser && message.status === "streaming" && !message.content) {
		return <PendingBubble content="" />;
	}

	return (
		<div
			style={{
				display: "flex",
				justifyContent: isUser ? "flex-end" : "flex-start",
				margin: "6px 0",
			}}
		>
			<div
				style={{
					background: isUser ? "var(--surface)" : "transparent",
					border: isUser ? "1px solid var(--border)" : "none",
					borderRadius: "var(--radius-lg)",
					color: "var(--ink)",
					fontSize: "15px",
					lineHeight: "1.6",
					maxWidth: isUser ? "80%" : "100%",
					padding: isUser ? "10px 14px" : "2px 0",
					whiteSpace: isUser ? "pre-wrap" : "normal",
					wordBreak: "break-word",
				}}
			>
				{isUser ? (
					<UserMessageContent content={message.content} />
				) : (
					<AssistantMarkdown text={message.content} />
				)}
				{message.attachments.length > 0 && (
					<div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
						{message.attachments.map((a) =>
							a.displayUrl && a.mimeType.startsWith("image/") ? (
								// biome-ignore lint/performance/noImgElement: signed display URLs are short-lived; next/image optimization does not apply
								<img
									alt="Attachment"
									key={a.id}
									src={a.displayUrl}
									style={{
										borderRadius: "var(--radius-md)",
										maxHeight: "320px",
										maxWidth: "100%",
										objectFit: "contain",
									}}
								/>
							) : (
								<span
									key={a.id}
									style={{
										alignItems: "center",
										color: "var(--ink-subtle)",
										display: "inline-flex",
										fontSize: "13px",
										gap: "4px",
									}}
								>
									<Paperclip size={12} /> Attachment ({a.mimeType})
								</span>
							),
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// Matches the /automation slash-command token the composer chip serializes
// to, so sent messages render it as the same labeled chip.
const AUTOMATION_COMMAND_SPLIT = /(\/automation\b)/;

function UserMessageContent({ content }: { content: string }) {
	if (!AUTOMATION_COMMAND_SPLIT.test(content)) {
		return <>{content}</>;
	}

	return (
		<>
			{content.split(AUTOMATION_COMMAND_SPLIT).map((part, index) =>
				part === "/automation" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: parts are a static split of immutable text
					<span className="composer-chip" key={index}>
						<Zap aria-hidden size={12} /> Automation
					</span>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: parts are a static split of immutable text
					<span key={index}>{part}</span>
				),
			)}
		</>
	);
}

export function PendingBubble({ content }: { content: string }) {
	return (
		<div style={{ display: "flex", justifyContent: "flex-start", margin: "6px 0" }}>
			<div
				style={{
					color: "var(--ink)",
					fontSize: "15px",
					lineHeight: "1.6",
					maxWidth: "80%",
					padding: "2px 0",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
				}}
			>
				{content ? (
					<AssistantMarkdown text={content} />
				) : (
					<span
						className="animate-[shimmer_1.5s_ease-in-out_infinite]"
						style={{
							background: "var(--surface)",
							borderRadius: "var(--radius-sm)",
							display: "inline-block",
							height: "1em",
							width: "120px",
						}}
					/>
				)}
			</div>
		</div>
	);
}
