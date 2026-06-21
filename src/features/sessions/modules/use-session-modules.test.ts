import { describe, expect, it } from "bun:test";

import type { AssistantPart, ToolPart, TranscriptTurn } from "@/lib/session-transcript";
import { deriveModules } from "./use-session-modules";

function toolPart(tool: ToolPart): AssistantPart {
	return { id: `tool:${tool.callId}`, kind: "tool", tool };
}

function turn(id: string, tools: ToolPart[]): TranscriptTurn {
	return {
		activity: { streaming: false, summary: null },
		assistantMessages: [],
		id,
		looseMessages: [],
		parts: tools.map(toolPart),
		userMessage: null,
		visibleTextStreaming: false,
	};
}

describe("deriveModules", () => {
	it("ignores non-module tools", () => {
		const result = deriveModules([
			turn("t1", [
				{ callId: "c1", input: { query: "hi" }, status: "completed", tool: "web.search" },
			]),
		]);

		expect(result.modules).toHaveLength(0);
	});

	it("creates an optimistic document module while streaming, then resolves the durable id", () => {
		const streaming = deriveModules([
			turn("t1", [
				{
					callId: "c1",
					input: { content: "# Draft", title: "Plan" },
					status: "running",
					tool: "document.create",
				},
			]),
		]);

		expect(streaming.modules).toHaveLength(1);
		const optimistic = streaming.modules[0];
		expect(optimistic?.kind).toBe("document");
		expect(optimistic?.id).toBe("tool:c1");
		expect(optimistic?.status).toBe("streaming");
		expect(optimistic?.kind === "document" && optimistic.documentId).toBeNull();
		expect(optimistic?.kind === "document" && optimistic.draftMarkdown).toBe("# Draft");

		const completed = deriveModules([
			turn("t1", [
				{
					callId: "c1",
					input: { content: "# Draft", title: "Plan" },
					output: { documentId: "doc-1", title: "Plan", version: 1 },
					status: "completed",
					tool: "document.create",
				},
			]),
		]);

		expect(completed.modules).toHaveLength(1);
		const ready = completed.modules[0];
		expect(ready?.id).toBe("doc-1");
		expect(ready?.status).toBe("ready");
		expect(ready?.kind === "document" && ready.documentId).toBe("doc-1");
		expect(completed.moduleIdByCallId.get("c1")).toBe("doc-1");
		expect(completed.lastTouchedId).toBe("doc-1");
		expect(completed.lastTouchedCallId).toBe("c1");
	});

	it("creates an email module from the persisted draft output", () => {
		const result = deriveModules([
			turn("t1", [
				{
					callId: "c1",
					input: { body: "Hi", kind: "new", subject: "Hello", to: "a@b.com" },
					output: {
						artifact: { id: "art-1" },
						draft: {
							bcc: [],
							body: "Hi",
							cc: ["c@d.com"],
							id: "art-1",
							kind: "new",
							subject: "Hello",
							to: "a@b.com",
						},
					},
					status: "completed",
					tool: "email.draft.create",
				},
			]),
		]);

		expect(result.modules).toHaveLength(1);
		const module = result.modules[0];
		expect(module?.kind).toBe("email");
		expect(module?.id).toBe("art-1");
		expect(module?.kind === "email" && module.artifactId).toBe("art-1");
		expect(module?.kind === "email" && module.email.subject).toBe("Hello");
		expect(module?.kind === "email" && module.email.cc).toEqual(["c@d.com"]);
		expect(module?.title).toBe("Hello");
	});

	it("merges an edit into the existing module without creating a duplicate tab", () => {
		const result = deriveModules([
			turn("t1", [
				{
					callId: "c1",
					input: { body: "Hi", kind: "new", subject: "Hello", to: "a@b.com" },
					output: {
						artifact: { id: "art-1" },
						draft: { body: "Hi", id: "art-1", subject: "Hello", to: "a@b.com" },
					},
					status: "completed",
					tool: "email.draft.create",
				},
			]),
			turn("t2", [
				{
					callId: "c2",
					input: { draftId: "art-1", subject: "Hello (revised)" },
					output: {
						artifact: { id: "art-1" },
						draft: { body: "Hi", id: "art-1", subject: "Hello (revised)", to: "a@b.com" },
					},
					status: "completed",
					tool: "email.draft.update",
				},
			]),
		]);

		expect(result.modules).toHaveLength(1);
		const module = result.modules[0];
		expect(module?.id).toBe("art-1");
		expect(module?.kind === "email" && module.email.subject).toBe("Hello (revised)");
		expect(module?.callIds).toEqual(["c1", "c2"]);
		expect(result.moduleIdByCallId.get("c2")).toBe("art-1");
		expect(result.lastTouchedCallId).toBe("c2");
	});

	it("ignores an edit whose target was not created in this transcript", () => {
		const result = deriveModules([
			turn("t1", [
				{
					callId: "c1",
					input: { documentId: "doc-x", edits: [] },
					status: "completed",
					tool: "document.edit",
				},
			]),
		]);

		expect(result.modules).toHaveLength(0);
	});

	it("orders modules by first-seen sequence", () => {
		const result = deriveModules([
			turn("t1", [
				{
					callId: "c1",
					input: { content: "a", title: "A" },
					output: { documentId: "doc-a", title: "A", version: 1 },
					status: "completed",
					tool: "document.create",
				},
				{
					callId: "c2",
					input: { body: "b", kind: "new", subject: "B" },
					output: { draft: { id: "art-b", subject: "B" } },
					status: "completed",
					tool: "email.draft.create",
				},
			]),
		]);

		expect(result.modules.map((module) => module.id)).toEqual(["doc-a", "art-b"]);
	});
});
