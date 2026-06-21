// Shared, icon-agnostic slash-command serialization for automations. The token
// strings here are the contract with the agent runtime (which detects the
// /automation command and parses a mention's automation_id), so web and mobile
// must produce them identically — hence this lives in client-core, not per client.

/** The create-automation command token. The runtime seeds the turn with a
 * directive to call automation.guide before configuring anything. */
export const CREATE_AUTOMATION_TOKEN = "/automation";

// Mention-chip palette (Town-style colored dots), assigned per automation by a
// stable hash of its id so colors survive list reordering.
const MENTION_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#22c55e", "#f97316", "#e879a6"];

export function automationMentionColor(id: string): string {
	let hash = 0;
	for (let index = 0; index < id.length; index += 1) {
		hash = (hash * 31 + id.charCodeAt(index)) | 0;
	}
	return MENTION_COLORS[Math.abs(hash) % MENTION_COLORS.length] ?? "#8b5cf6";
}

/** The text a mention contributes to the submitted message: names the automation
 * and carries its id so the agent can act on the exact one. */
export function automationMentionToken(automation: { id: string; name: string }): string {
	return `"${automation.name}" automation (automation_id: ${automation.id})`;
}

/** Does the current composer text look like an in-progress slash command (a
 * leading "/" with no whitespace yet)? If so, the menu shows and the substring
 * after "/" is the filter query. */
export function slashCommandQuery(value: string): string | null {
	return /^\/\S*$/.test(value) ? value.slice(1) : null;
}

/** Case-insensitive substring match over a row's label + keywords. */
export function matchesSlashQuery(
	query: string,
	row: { keywords: string[]; label: string },
): boolean {
	const q = query.trim().toLowerCase();
	if (!q) {
		return true;
	}
	return [row.label, ...row.keywords].some((keyword) => keyword.toLowerCase().includes(q));
}
