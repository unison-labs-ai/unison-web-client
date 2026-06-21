import {
	type SessionTriggerReference,
	sessionTriggerReferenceSchema,
	type ThreadMessage,
} from "@unison/contracts";

export function triggerReferenceFromMessage(
	message: ThreadMessage,
): SessionTriggerReference | null {
	const parsed = sessionTriggerReferenceSchema.safeParse(message.metadata.triggerReference);
	if (parsed.success) return parsed.data;

	return triggerReferenceFromLegacyContent(message);
}

export function isLegacyAutomationRequestMessage(message: ThreadMessage): boolean {
	return (
		message.metadata.source === "automation.session_request" &&
		!sessionTriggerReferenceSchema.safeParse(message.metadata.triggerReference).success
	);
}

export function isTriggerMessage(message: ThreadMessage): boolean {
	return triggerReferenceFromMessage(message) !== null || isLegacyAutomationRequestMessage(message);
}

function lineValue(content: string, label: string): string | undefined {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = content.match(new RegExp(`^${escaped}:\\s*(.+)$`, "m"));
	return match?.[1]?.trim();
}

function triggerReferenceFromLegacyContent(message: ThreadMessage): SessionTriggerReference | null {
	const eventType = message.content.match(/^A new ([\w.:-]+) event triggered this run\./m)?.[1];
	const hasSourceFence =
		message.content.includes("<source_reference>") ||
		message.content.includes("<source_content_untrusted>");

	if (!eventType || !hasSourceFence) return null;

	const occurredAt = lineValue(message.content, "occurredAt") ?? message.createdAt;
	const sourceEventId =
		lineValue(message.content, "sourceEventId") ?? lineValue(message.content, "externalEventId");
	const title = lineValue(message.content, "title") ?? `New ${eventType} event`;
	const actor = lineValue(message.content, "from");
	const snippet = lineValue(message.content, "snippet");

	return {
		display: {
			actor,
			snippet,
			title,
		},
		kind: "connector_event",
		occurredAt,
		source: {
			eventType,
			sourceEventId,
			externalIds: {
				externalEventId: lineValue(message.content, "externalEventId") ?? "",
				gmailMessageId: lineValue(message.content, "gmailMessageId") ?? "",
				gmailThreadId: lineValue(message.content, "gmailThreadId") ?? "",
			},
		},
	};
}
