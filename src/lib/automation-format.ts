import type { AgentToolSideEffectClass, AutomationTrigger } from "@unison/contracts";
import type { LucideIcon } from "lucide-react";
import {
	Activity,
	Calendar,
	Clock,
	Mail,
	Mic,
	MousePointerClick,
	Users,
	Webhook,
	Workflow,
} from "lucide-react";

/** Human-readable labels for automation trigger types (screens.md §5 "trigger summary"). */
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
	automation_call: "Automation call",
	calendar: "Calendar",
	capture: "Capture",
	gmail: "Gmail",
	manual: "Manual",
	meeting: "Meeting completed",
	schedule: "Schedule",
	source_event: "Source event",
	webhook: "Webhook",
};

export const TRIGGER_ICONS: Record<string, LucideIcon> = {
	automation_call: Workflow,
	calendar: Calendar,
	capture: Mic,
	gmail: Mail,
	manual: MousePointerClick,
	meeting: Users,
	schedule: Clock,
	source_event: Activity,
	webhook: Webhook,
};

/** One-line trigger-type blurbs (the manage-modal pane subtitles). */
export const TRIGGER_TYPE_DESCRIPTIONS: Record<string, string> = {
	automation_call: "Runs when another automation calls this one.",
	calendar: "Runs when calendar events change.",
	capture: "Runs when a capture finishes processing.",
	gmail: "Runs when a new email arrives.",
	manual: "Run it yourself from this page.",
	meeting: "Runs when a meeting note is ready (Granola).",
	schedule: "Runs on a recurring schedule.",
	source_event: "Runs on matching source events.",
	webhook: "Runs when the webhook receives a request.",
};

export const WEEKDAY_OPTIONS = [
	{ label: "Sunday", value: "0" },
	{ label: "Monday", value: "1" },
	{ label: "Tuesday", value: "2" },
	{ label: "Wednesday", value: "3" },
	{ label: "Thursday", value: "4" },
	{ label: "Friday", value: "5" },
	{ label: "Saturday", value: "6" },
];

/** "Daily at 09:00 (Europe/Amsterdam)" — derived from a schedule trigger's config. */
export function scheduleSummary(config: Record<string, unknown>): string | null {
	const frequency = typeof config.frequency === "string" ? config.frequency : null;
	if (!frequency) return null;
	const pad = (n: number) => String(n).padStart(2, "0");
	const hour = typeof config.hour === "number" ? config.hour : 9;
	const minute = typeof config.minute === "number" ? config.minute : 0;
	const time = `${pad(hour)}:${pad(minute)}`;
	let summary: string;
	switch (frequency) {
		case "hourly":
			summary = `Hourly at :${pad(minute)}`;
			break;
		case "daily":
			summary = `Daily at ${time}`;
			break;
		case "weekdays":
			summary = `Weekdays at ${time}`;
			break;
		case "weekly": {
			const weekday = typeof config.weekday === "number" ? config.weekday : 1;
			summary = `${WEEKDAY_OPTIONS[weekday]?.label ?? "Monday"}s at ${time}`;
			break;
		}
		case "monthly": {
			const day = typeof config.day === "number" ? config.day : 1;
			summary = `Monthly on day ${day} at ${time}`;
			break;
		}
		case "interval": {
			const minutes = typeof config.intervalMinutes === "number" ? config.intervalMinutes : 60;
			summary = `Every ${minutes} minutes`;
			break;
		}
		default:
			return null;
	}
	const timezone = typeof config.timezone === "string" ? config.timezone : null;
	return timezone ? `${summary} (${timezone})` : summary;
}

/** Muted second line under a trigger row (schedule summary / repeated type). */
export function triggerSubtitle(trigger: AutomationTrigger): string | null {
	if (trigger.triggerType === "schedule") {
		return scheduleSummary(trigger.config) ?? null;
	}
	// When the row title is a custom display name, repeat the type underneath.
	return trigger.displayName ? (TRIGGER_TYPE_LABELS[trigger.triggerType] ?? null) : null;
}

/** One-line summary of an automation's triggers, e.g. "Schedule · Gmail". */
export function triggerSummary(triggers: { triggerType: string }[]): string {
	if (triggers.length === 0) return "Manual only";
	const labels = [
		...new Set(triggers.map((t) => TRIGGER_TYPE_LABELS[t.triggerType] ?? t.triggerType)),
	];
	return labels.join(" · ");
}

/**
 * Least → most dangerous. Mirrors the declaration order of
 * agentToolSideEffectClassSchema in @unison/contracts (screens.md §5 tools picker).
 */
export const SIDE_EFFECT_CLASS_ORDER: AgentToolSideEffectClass[] = [
	"read",
	"internal_write",
	"external_draft",
	"external_send",
	"external_write",
	"destructive",
];

/** Display labels for side-effect classes (tool picker group headers). */
export const SIDE_EFFECT_CLASS_LABELS: Record<AgentToolSideEffectClass, string> = {
	destructive: "Destructive",
	external_draft: "External draft",
	external_send: "External send",
	external_write: "External write",
	internal_write: "Internal write",
	read: "Read",
};

/** Annotation for a tool's effective permission, e.g. "always allow" (screens.md §3). */
export function permissionAnnotation(permission: string | null): string {
	switch (permission) {
		case "always_allow":
			return "always allow";
		case "ask_for_approval":
			return "asks for approval";
		case "always_reject":
			return "always rejected";
		default:
			return "workspace default";
	}
}
