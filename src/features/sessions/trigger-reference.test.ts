import { describe, expect, test } from "bun:test";
import { type ThreadMessage, threadMessageSchema } from "@unison/contracts";

import {
	isLegacyAutomationRequestMessage,
	isTriggerMessage,
	triggerReferenceFromMessage,
} from "./trigger-reference";

const ISO = "2026-06-11T10:31:49.307Z";

function message(overrides: Partial<ThreadMessage>): ThreadMessage {
	return threadMessageSchema.parse({
		attachments: [],
		clientMessageId: null,
		content: "",
		contentFormat: "text",
		createdAt: ISO,
		id: "00000000-0000-4000-8000-000000000001",
		messageSeq: 1,
		metadata: {},
		parentMessageId: null,
		role: "user",
		sessionId: "00000000-0000-4000-8000-000000000002",
		status: "complete",
		threadId: "00000000-0000-4000-8000-000000000003",
		turnId: "00000000-0000-4000-8000-000000000004",
		...overrides,
	});
}

describe("session trigger references", () => {
	test("parses typed trigger references from metadata", () => {
		const reference = {
			display: {
				actor: "Vercel <notifications@vercel.com>",
				snippet: "Deploy failed.",
				title: "Failed deployment",
			},
			kind: "connector_event",
			occurredAt: ISO,
			source: { eventType: "gmail.message", sourceEventId: "source-1" },
		};
		const item = message({
			content: "A new gmail.message event triggered this run.",
			metadata: { kind: "trigger_reference", triggerReference: reference },
		});

		expect(triggerReferenceFromMessage(item)?.display.title).toBe("Failed deployment");
		expect(isTriggerMessage(item)).toBe(true);
	});

	test("builds a display card model from legacy Gmail runbook content", () => {
		const item = message({
			content: `A new gmail.message event triggered this run.

<source_reference>
sourceEventId: 3161f610-2fbe-488f-8ce7-8d1b10aacd9a
gmailMessageId: 19eb63cea8e27f02
occurredAt: ${ISO}
</source_reference>

<source_content_untrusted>
from: Vercel <notifications@vercel.com>
title: Failed deployment from rafmevis@Rafs-MacBook-Pro.local
snippet: Attempted to deploy a commit to Unison on Vercel, but they are not a member.
</source_content_untrusted>`,
		});

		const reference = triggerReferenceFromMessage(item);

		expect(reference?.source?.eventType).toBe("gmail.message");
		expect(reference?.display.actor).toBe("Vercel <notifications@vercel.com>");
		expect(reference?.display.title).toBe("Failed deployment from rafmevis@Rafs-MacBook-Pro.local");
		expect(isTriggerMessage(item)).toBe(true);
		expect(isLegacyAutomationRequestMessage(item)).toBe(false);
	});

	test("keeps legacy automation source messages collapsible", () => {
		const item = message({
			content: "Automation runbook wall of text",
			metadata: { source: "automation.session_request" },
		});

		expect(triggerReferenceFromMessage(item)).toBeNull();
		expect(isLegacyAutomationRequestMessage(item)).toBe(true);
		expect(isTriggerMessage(item)).toBe(true);
	});
});
