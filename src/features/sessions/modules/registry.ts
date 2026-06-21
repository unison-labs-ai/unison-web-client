import { recordValue, stringValue } from "@/lib/session-transcript";

import type { ModuleKind } from "./types";

// ---------------------------------------------------------------------------
// Module tool registry (plan §6.2). Maps a tool name to the module it produces
// and how to resolve that module's stable id — from the input (edits know their
// target up front) and/or the output (creates learn it on completion). Adding a
// future artifact kind (slide deck, …) is one entry here. Mirrors the shape of
// `tool-registry.tsx`, which still renders the inline cards for non-module tools.
// ---------------------------------------------------------------------------

export interface ModuleToolSpec {
	/** True when this tool edits an existing module rather than creating one. */
	isEdit: boolean;
	/** Stable domain id carried on the tool input (present for edits). */
	idFromInput?: (input: Record<string, unknown> | undefined) => string | null;
	/** Stable domain id learned from the tool output (present once completed). */
	idFromOutput?: (output: Record<string, unknown> | undefined) => string | null;
	kind: ModuleKind;
}

const docId = (record: Record<string, unknown> | undefined) =>
	stringValue(record, "documentId") ?? null;

const draftId = (output: Record<string, unknown> | undefined) =>
	stringValue(recordValue(output?.draft), "id") ??
	stringValue(recordValue(output?.artifact), "id") ??
	null;

const artifactId = (output: Record<string, unknown> | undefined) =>
	stringValue(recordValue(output?.artifact), "id") ?? null;

const automationId = (output: Record<string, unknown> | undefined) =>
	stringValue(recordValue(output?.automation), "id") ?? null;

export const MODULE_TOOLS: Record<string, ModuleToolSpec> = {
	"artifact.create": {
		idFromOutput: artifactId,
		isEdit: false,
		kind: "report",
	},
	"artifact.update": {
		idFromInput: (input) => stringValue(input, "artifactId") ?? null,
		idFromOutput: artifactId,
		isEdit: true,
		kind: "report",
	},
	"document.create": {
		idFromOutput: docId,
		isEdit: false,
		kind: "document",
	},
	"document.edit": {
		idFromInput: docId,
		idFromOutput: docId,
		isEdit: true,
		kind: "document",
	},
	"document.update": {
		idFromInput: docId,
		idFromOutput: docId,
		isEdit: true,
		kind: "document",
	},
	"email.draft.create": {
		idFromOutput: draftId,
		isEdit: false,
		kind: "email",
	},
	"email.draft.update": {
		idFromInput: (input) => stringValue(input, "draftId") ?? null,
		idFromOutput: draftId,
		isEdit: true,
		kind: "email",
	},
	"automation.create": {
		idFromOutput: automationId,
		isEdit: false,
		kind: "automation",
	},
	"automation.update": {
		idFromInput: (input) => stringValue(input, "automationId") ?? null,
		idFromOutput: automationId,
		isEdit: true,
		kind: "automation",
	},
};

export function moduleToolSpec(name: string): ModuleToolSpec | undefined {
	return MODULE_TOOLS[name];
}

export function isModuleTool(name: string): boolean {
	return name in MODULE_TOOLS;
}
