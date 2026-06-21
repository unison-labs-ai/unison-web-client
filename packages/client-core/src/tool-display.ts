/**
 * User-facing display labels for tool calls in the chat transcript.
 *
 * Authored HERE (the open client seam), NOT in @unison/tools: the architecture
 * forbids clients depending on the engine-cluster tools package
 * (system-architecture.md §7 / ARC-003 — "clients speak the wire protocol
 * only"). These are deliberately NOT the agent-facing `description` from the
 * manifest (those are verbose, written for the model). They are the short,
 * friendly phrases shown while tool calls stream and inside the collapsible
 * tool-group accordion — single source of truth for web + mobile.
 *
 * The tool→toolset derivation is kept in sync with the real manifest by
 * tool-display.test.ts (which may import @unison/tools as a devDependency).
 * See docs/plans/2026-06-17-tool-call-streaming-visualization.md §12.
 */

const BRIDGE_TOOL_NAMES = new Set(["load_toolset", "tool_search", "tool_call"]);

// Irregular tool→toolset mappings the name-prefix heuristic can't infer.
const SPECIAL_TOOLSET: Record<string, string> = {
	"code.run": "sandbox",
	"memory.remember": "memory",
	"scheduledSession.create": "scheduled_session",
	"sourceEvent.get": "capture",
};

/** Accordion HEADER label, keyed by toolset id (+ the synthetic "bridge"). */
export const TOOLSET_GROUP_LABEL: Record<string, string> = {
	artifact: "Updated an artifact",
	automation: "Managed automations",
	brain: "Used brain",
	calendar: "Used Calendar integration",
	capture: "Reviewed captures",
	clickup: "Used ClickUp integration",
	docs: "Used Google Docs",
	document: "Worked on documents",
	drive: "Used Google Drive",
	email: "Drafted an email",
	gmail: "Used Gmail integration",
	granola: "Used Granola integration",
	linear: "Used Linear integration",
	memory: "Updated memory",
	notification: "Sent a notification",
	people: "Searched contacts",
	reminder: "Updated reminders",
	sandbox: "Ran code",
	scheduled_session: "Scheduled a session",
	sheets: "Used Google Sheets",
	skill: "Loaded a skill",
	telegram: "Used Telegram integration",
	web: "Searched the web",
	bridge: "Loaded tools",
};

/**
 * Short (<=10 words, past tense) per-tool ROW label, shown for each call inside a
 * group and as the line that streams in place of the call. Keyed by tool name.
 */
export const TOOL_ROW_LABEL: Record<string, string> = {
	"brain.search": "Searched brain",
	"brain.get": "Read a brain doc",
	"brain.factsAbout": "Looked up brain facts",
	"brain.resolveEntity": "Resolved a brain entity",
	"brain.list": "Listed brain docs",
	"web.search": "Searched the web",
	"web.extract": "Read a web page",
	"code.run": "Ran code",
	"capture.get": "Read a capture",
	"capture.listRecent": "Listed recent captures",
	"connector.google.gmail.getMessage": "Read an email",
	"connector.google.gmail.getThread": "Read an email thread",
	"connector.google.gmail.searchMessages": "Searched Gmail",
	"connector.google.gmail.listLabels": "Listed Gmail labels",
	"connector.google.gmail.modifyLabels": "Updated Gmail labels",
	"connector.google.gmail.addLabel": "Labeled an email",
	"connector.google.gmail.removeLabel": "Removed an email label",
	"connector.google.gmail.createLabel": "Created a Gmail label",
	"connector.google.gmail.archive": "Archived an email",
	"connector.google.gmail.createDraft": "Created a draft",
	"connector.google.gmail.updateDraft": "Updated a draft",
	"connector.google.gmail.sendEmailToSelf": "Emailed yourself",
	"connector.google.people.search": "Searched contacts",
	"connector.google.calendar.listEvents": "Checked your calendar",
	"connector.google.calendar.getEvent": "Read an event",
	"connector.google.calendar.freeBusy": "Checked availability",
	"connector.google.calendar.createEvent": "Created an event",
	"connector.google.calendar.updateEvent": "Updated an event",
	"connector.google.calendar.deleteEvent": "Deleted an event",
	"connector.google.drive.createFile": "Created a Drive file",
	"connector.google.docs.createDocument": "Created a Google Doc",
	"connector.granola.meetings.list": "Listed Granola meetings",
	"connector.granola.meetings.get": "Read a meeting",
	"connector.granola.meetings.getTranscript": "Read a transcript",
	"connector.granola.meetings.listFolders": "Listed Granola folders",
	"connector.linear.issues.list": "Listed Linear issues",
	"connector.linear.issues.get": "Read a Linear issue",
	"connector.linear.issues.statuses": "Listed issue statuses",
	"connector.linear.issues.labels": "Listed issue labels",
	"connector.linear.comments.list": "Listed Linear comments",
	"connector.linear.projects.list": "Listed Linear projects",
	"connector.linear.projects.get": "Read a Linear project",
	"connector.linear.cycles.list": "Listed Linear cycles",
	"connector.linear.teams.list": "Listed Linear teams",
	"connector.linear.users.list": "Listed Linear users",
	"connector.linear.issues.save": "Saved a Linear issue",
	"connector.linear.comments.save": "Posted a Linear comment",
	"connector.linear.projects.save": "Saved a Linear project",
	"connector.linear.issues.createLabel": "Created an issue label",
	"connector.linear.projects.saveStatusUpdate": "Posted a status update",
	"connector.clickup.tasks.list": "Listed ClickUp tasks",
	"connector.clickup.tasks.get": "Read a ClickUp task",
	"connector.clickup.spaces.list": "Listed ClickUp spaces",
	"connector.clickup.lists.get": "Read a ClickUp list",
	"connector.clickup.teams.list": "Listed ClickUp workspaces",
	"connector.clickup.members.list": "Listed ClickUp members",
	"connector.clickup.tasks.create": "Created a ClickUp task",
	"connector.clickup.tasks.update": "Updated a ClickUp task",
	"connector.clickup.comments.create": "Posted a ClickUp comment",
	"connector.clickup.tasks.delete": "Deleted a ClickUp task",
	"telegram.send_message": "Sent a Telegram message",
	"telegram.send_document": "Sent a Telegram document",
	"telegram.send_photo": "Sent a Telegram photo",
	"telegram.get_chat": "Read a Telegram chat",
	"artifact.create": "Created an artifact",
	"artifact.update": "Updated an artifact",
	"artifact.appendTableRows": "Updated a table",
	"document.create": "Created a document",
	"document.list": "Listed documents",
	"document.get": "Read a document",
	"document.edit": "Edited a document",
	"document.update": "Updated a document",
	"document.delete": "Deleted a document",
	"skill.load": "Loaded a skill",
	"email.draft.create": "Drafted an email",
	"email.draft.update": "Updated the draft",
	"reminder.create": "Set a reminder",
	"reminder.update": "Updated a reminder",
	"reminder.complete": "Completed a reminder",
	"notification.create": "Sent a notification",
	"notification.get": "Read a notification",
	"notification.dismiss": "Dismissed a notification",
	"notification.snooze": "Snoozed a notification",
	"scheduledSession.create": "Scheduled a session",
	"sourceEvent.get": "Read a source event",
	"automation.guide": "Opened the automation guide",
	"automation.list": "Listed automations",
	"automation.get": "Read an automation",
	"automation.create": "Created an automation",
	"automation.update": "Updated an automation",
	"automation.setEnabled": "Toggled an automation",
	"automation.dryRun": "Tested an automation",
	"automation.test": "Tested an automation",
	"automation.call": "Ran an automation",
	"memory.remember": "Updated memory",
	load_toolset: "Loaded tools",
	tool_search: "Found tools",
	tool_call: "Called a tool",
};

/**
 * The toolset a tool belongs to, derived from its name. Kept in sync with the
 * manifest by tool-display.test.ts. Returns "bridge" for the runtime-injected
 * deferral tools.
 */
export function toolsetForTool(name: string): string {
	if (BRIDGE_TOOL_NAMES.has(name)) {
		return "bridge";
	}
	if (name in SPECIAL_TOOLSET) {
		return SPECIAL_TOOLSET[name] as string;
	}
	if (name.startsWith("connector.google.")) {
		return name.split(".")[2] ?? "";
	}
	if (name.startsWith("connector.granola.")) {
		return "granola";
	}
	if (name.startsWith("connector.linear.")) {
		return "linear";
	}
	if (name.startsWith("connector.clickup.")) {
		return "clickup";
	}
	if (name.startsWith("email.draft.")) {
		return "email";
	}
	return name.split(".")[0] ?? "";
}

function humanizeToolName(name: string): string {
	const leaf = name.split(".").pop() ?? name;
	const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_]/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Short user-facing row label for a tool; falls back to a humanized name. */
export function toolRowLabel(name: string): string {
	return TOOL_ROW_LABEL[name] ?? humanizeToolName(name);
}

function lowerFirst(value: string): string {
	return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

/**
 * Deterministic HEADER title for a group of tool calls: the distinct toolset
 * labels in first-seen order, the first kept as-is and the rest lower-cased,
 * joined with ", " — e.g. ["...gmail.searchMessages", "load_toolset"] ->
 * "Used Gmail integration, loaded tools".
 */
export function toolGroupTitle(toolNames: string[]): string {
	const labels: string[] = [];
	const seen = new Set<string>();
	for (const name of toolNames) {
		const toolset = toolsetForTool(name);
		if (seen.has(toolset)) {
			continue;
		}
		seen.add(toolset);
		labels.push(TOOLSET_GROUP_LABEL[toolset] ?? "Used tools");
	}
	if (labels.length === 0) {
		return "Used tools";
	}
	return labels.map((label, index) => (index === 0 ? label : lowerFirst(label))).join(", ");
}
