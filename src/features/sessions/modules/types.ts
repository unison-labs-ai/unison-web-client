// ---------------------------------------------------------------------------
// Session artifact "module" model (plan §6.1). A module is a tab in the session
// panel, derived from the agent's tool calls. The id is the stable domain id
// once known (documentId / email-draft artifact id), or `tool:<callId>` while a
// create is still streaming and hasn't been assigned one.
// ---------------------------------------------------------------------------

export type ModuleKind = "automation" | "document" | "email" | "overview" | "report" | "transcript";

export type ModuleStatus = "streaming" | "ready" | "error";

export interface EmailDraftContent {
	bcc: string[];
	body: string;
	cc: string[];
	gmailMessageId?: string;
	gmailThreadId?: string;
	kind: "new" | "reply";
	subject: string;
	to: string;
}

interface ModuleBase {
	/** Every tool call that produced or edited this module — links chips ↔ tab. */
	callIds: string[];
	/** Stable domain id, or `tool:<callId>` until a create resolves one. */
	id: string;
	kind: ModuleKind;
	/** First-seen order across the transcript → tab order. */
	seq: number;
	status: ModuleStatus;
	title: string;
}

/** The automation the agent just created or edited, shown as an in-chat overview.
 * The view loads the live automation by id; null while the create is streaming. */
export interface AutomationModule extends ModuleBase {
	automationId: string | null;
	kind: "automation";
}

export interface DocumentModule extends ModuleBase {
	/** Real document id once `document.create` completes; null while streaming. */
	documentId: string | null;
	/** Streamed markdown preview, shown until the live editor loads by id. */
	draftMarkdown: string;
	kind: "document";
}

export interface EmailModule extends ModuleBase {
	/** Real `email_draft` artifact id once the tool completes; null while streaming. */
	artifactId: string | null;
	/** Seed/preview content from the tool I/O; the view loads the live artifact. */
	email: EmailDraftContent;
	kind: "email";
}

export interface ReportModule extends ModuleBase {
	artifactId: string | null;
	kind: "report";
	markdown: string;
}

/** The synthetic index module: lists every other artifact in the session. Not
 * derived from a tool call — the provider injects one per session. */
export interface OverviewModule extends ModuleBase {
	kind: "overview";
}

/** The session's recording transcript, injected from the session's captureId
 * (not a tool call). Read-only; the view fetches the transcript by id. */
export interface TranscriptModule extends ModuleBase {
	captureId: string;
	kind: "transcript";
}

export type Module =
	| AutomationModule
	| DocumentModule
	| EmailModule
	| OverviewModule
	| ReportModule
	| TranscriptModule;

export function isStreaming(module: Module): boolean {
	return module.status === "streaming";
}
