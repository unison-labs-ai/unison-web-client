import type { AutomationWithRelations } from "@unison/contracts";
import type { LucideIcon } from "lucide-react";
import { Zap } from "lucide-react";

/** An inline token rendered as a styled chip inside the composer. */
export type ComposerChipSpec = {
	id: string;
	/** Visible chip label. */
	label: string;
	/** Text the chip contributes to the submitted message. */
	serialized: string;
	/** Mention chips get a colored dot + tint instead of the action icon. */
	color?: string;
};

export type SlashCommand = {
	chip: ComposerChipSpec;
	description: string;
	icon?: LucideIcon;
	keywords: string[];
	/** Popover group header; rendered when it changes between rows. */
	section?: string;
};

/** Serializes to the literal /automation command token: the agent runtime
 * detects it in the message text and seeds the turn with a directive to call
 * the automation.guide tool before configuring anything. */
export const AUTOMATION_CHIP: ComposerChipSpec = {
	id: "automation",
	label: "Automation",
	serialized: "/automation",
};

export const SLASH_COMMANDS: SlashCommand[] = [
	{
		chip: AUTOMATION_CHIP,
		description: "The agent sets up a recurring or triggered task",
		icon: Zap,
		keywords: ["automation", "routine", "schedule", "trigger", "recurring", "create", "new"],
		section: "Create",
	},
];

// Mention-chip palette (Town-style colored dots) — assigned per automation by
// a stable hash of its id so colors survive list reorderings.
const MENTION_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#22c55e", "#f97316", "#e879a6"];

export function mentionColor(id: string): string {
	let hash = 0;
	for (let i = 0; i < id.length; i += 1) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	const color = MENTION_COLORS[Math.abs(hash) % MENTION_COLORS.length];
	return color ?? "#8b5cf6";
}

/** A chip referencing one of the user's existing automations. The serialized
 * form names the automation and carries its id so the agent can act on the
 * exact one (e.g. `"Morning brief" automation (automation_id: …)`). */
export function automationMentionChip(automation: { id: string; name: string }): ComposerChipSpec {
	return {
		color: mentionColor(automation.id),
		id: `automation-mention:${automation.id}`,
		label: automation.name,
		serialized: `"${automation.name}" automation (automation_id: ${automation.id})`,
	};
}

/** The full slash menu: create actions plus a mention entry per automation. */
export function buildSlashCommands(automations: AutomationWithRelations[]): SlashCommand[] {
	const mentions: SlashCommand[] = automations.map((item) => ({
		chip: automationMentionChip(item.automation),
		description: item.automation.description ?? "Reference this automation",
		keywords: [item.automation.name, "automation", "routine"],
		section: "Your automations",
	}));
	return [...SLASH_COMMANDS, ...mentions];
}

export function filterSlashCommands(
	query: string,
	commands: SlashCommand[] = SLASH_COMMANDS,
): SlashCommand[] {
	const q = query.trim().toLowerCase();
	if (!q) return commands;
	return commands.filter((command) =>
		[command.chip.label, ...command.keywords].some((keyword) => keyword.toLowerCase().includes(q)),
	);
}
