import type { AutomationToolBinding, ToolCatalogEntryWithAvailability } from "@unison/contracts";
import type { LucideIcon } from "lucide-react";
import {
	AlarmClock,
	Bell,
	BookMarked,
	Brain,
	Calendar,
	CalendarClock,
	FileText,
	Globe,
	HardDrive,
	Layers,
	Mail,
	Mic,
	PenLine,
	SquareTerminal,
	Table,
	Users,
	Wrench,
} from "lucide-react";

/**
 * Display identity per tool registry toolset (Town's "toolset" rows: icon +
 * name + the enabled tools underneath). Unknown toolsets fall back to the
 * catalog displayGroup / a capitalized id with a generic icon.
 */
const TOOLSET_META: Record<string, { icon: LucideIcon; label: string }> = {
	artifact: { icon: Layers, label: "Artifacts" },
	brain: { icon: Brain, label: "Brain" },
	calendar: { icon: Calendar, label: "Calendar" },
	capture: { icon: Mic, label: "Captures" },
	docs: { icon: FileText, label: "Docs" },
	drive: { icon: HardDrive, label: "Drive" },
	email: { icon: PenLine, label: "Email drafts" },
	gmail: { icon: Mail, label: "Gmail" },
	memory: { icon: BookMarked, label: "Memory" },
	notification: { icon: Bell, label: "Notifications" },
	people: { icon: Users, label: "People" },
	reminder: { icon: AlarmClock, label: "Reminders" },
	sandbox: { icon: SquareTerminal, label: "Code" },
	scheduled_session: { icon: CalendarClock, label: "Scheduling" },
	sheets: { icon: Table, label: "Sheets" },
	web: { icon: Globe, label: "Web" },
};

/** Bindings whose tool left the automation-surface catalog group here. */
export const ORPHAN_TOOLSET_ID = "__other";

export type ToolsetTool = {
	canAlwaysAllow: boolean;
	description: string | null;
	/** Fixed tools keep their default permission; the approval override menu is disabled. */
	isFixed: boolean;
	name: string;
	title: string;
};

export type Toolset = {
	enabledCount: number;
	icon: LucideIcon;
	id: string;
	label: string;
	tools: ToolsetTool[];
};

function toolsetIdentity(
	id: string,
	displayGroup: string | null,
): { icon: LucideIcon; label: string } {
	const known = TOOLSET_META[id];
	if (known) return known;
	const label = displayGroup ?? id.charAt(0).toUpperCase() + id.slice(1).replaceAll("_", " ");
	return { icon: Wrench, label };
}

/**
 * Group the automation-surface catalog into Town-style toolsets, with the
 * enabled-binding count per set. Bindings whose tool is missing from the
 * catalog (renamed/retired tools) surface in a trailing "Other" set so they
 * stay visible and removable.
 */
export function buildToolsets(
	catalog: ToolCatalogEntryWithAvailability[],
	bindings: AutomationToolBinding[],
): Toolset[] {
	const enabledNames = new Set(bindings.filter((b) => b.enabled).map((b) => b.toolName));
	const automationTools = catalog.filter((tool) => tool.surfaces.includes("automation"));

	const sets = new Map<string, Toolset>();
	for (const tool of automationTools) {
		let set = sets.get(tool.toolsetId);
		if (!set) {
			const identity = toolsetIdentity(tool.toolsetId, tool.displayGroup);
			set = {
				enabledCount: 0,
				icon: identity.icon,
				id: tool.toolsetId,
				label: identity.label,
				tools: [],
			};
			sets.set(tool.toolsetId, set);
		}
		set.tools.push({
			canAlwaysAllow: tool.canAlwaysAllow,
			description: tool.description,
			isFixed: tool.policyMode === "fixed",
			name: tool.name,
			title: tool.title || tool.name,
		});
		if (enabledNames.has(tool.name)) set.enabledCount += 1;
	}

	const catalogNames = new Set(automationTools.map((tool) => tool.name));
	const orphans = bindings.filter((binding) => !catalogNames.has(binding.toolName));
	if (orphans.length > 0) {
		const set: Toolset = {
			enabledCount: orphans.filter((b) => b.enabled).length,
			icon: Wrench,
			id: ORPHAN_TOOLSET_ID,
			label: "Other",
			tools: orphans.map((binding) => ({
				canAlwaysAllow: true,
				description: binding.unavailableReason,
				isFixed: false,
				name: binding.toolName,
				title: binding.toolName,
			})),
		};
		sets.set(ORPHAN_TOOLSET_ID, set);
	}

	const result = [...sets.values()];
	for (const set of result) {
		set.tools.sort((a, b) => a.title.localeCompare(b.title));
	}
	result.sort((a, b) => a.label.localeCompare(b.label));
	return result;
}

/** Titles of the enabled tools in a set — the card row's muted one-liner. */
export function enabledToolTitles(set: Toolset, bindings: AutomationToolBinding[]): string[] {
	const enabledNames = new Set(bindings.filter((b) => b.enabled).map((b) => b.toolName));
	return set.tools.filter((tool) => enabledNames.has(tool.name)).map((tool) => tool.title);
}
