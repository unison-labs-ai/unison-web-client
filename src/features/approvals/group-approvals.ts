import type { AgentToolApproval } from "@unison/contracts";

export function groupBySession(approvals: AgentToolApproval[]): Map<string, AgentToolApproval[]> {
	const map = new Map<string, AgentToolApproval[]>();
	for (const approval of approvals) {
		const group = map.get(approval.sessionId) ?? [];
		group.push(approval);
		map.set(approval.sessionId, group);
	}
	return map;
}
