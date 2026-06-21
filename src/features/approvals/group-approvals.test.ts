import { describe, expect, it } from "bun:test";
import { type AgentToolApproval, agentToolApprovalSchema } from "@unison/contracts";

import { groupBySession } from "./group-approvals";

const SESSION_A = "00000000-0000-4000-8000-00000000000a";
const SESSION_B = "00000000-0000-4000-8000-00000000000b";
const ISO = "2026-06-09T10:00:00.000Z";

function approval(overrides: Partial<AgentToolApproval>): AgentToolApproval {
	return agentToolApprovalSchema.parse({
		createdAt: ISO,
		decidedAt: null,
		decisionNote: null,
		expiresAt: null,
		id: "00000000-0000-4000-8000-000000000001",
		input: {},
		metadata: {},
		requestedReason: null,
		sessionId: SESSION_A,
		status: "pending",
		tenantId: "00000000-0000-4000-8000-000000000002",
		toolCallId: "00000000-0000-4000-8000-000000000003",
		toolName: "connector.google.gmail.createDraft",
		updatedAt: ISO,
		userId: "00000000-0000-4000-8000-000000000004",
		...overrides,
	});
}

describe("approvals grouping", () => {
	it("groups interleaved approvals by session and keeps first-seen session order", () => {
		const first = approval({ id: "00000000-0000-4000-8000-000000000011", sessionId: SESSION_A });
		const second = approval({ id: "00000000-0000-4000-8000-000000000012", sessionId: SESSION_B });
		const third = approval({ id: "00000000-0000-4000-8000-000000000013", sessionId: SESSION_A });

		const grouped = groupBySession([first, second, third]);

		expect(Array.from(grouped.keys())).toEqual([SESSION_A, SESSION_B]);
		expect(grouped.get(SESSION_A)).toEqual([first, third]);
		expect(grouped.get(SESSION_B)).toEqual([second]);
	});

	it("returns an empty map for no approvals", () => {
		expect(groupBySession([]).size).toBe(0);
	});
});
