import { describe, expect, test } from "bun:test";

import {
	type GroupablePart,
	groupParts,
	type RenderBlock,
	toolGroupMode,
	visibleTools,
} from "./tool-groups";

type Part = GroupablePart & { id: string; text?: string };

const text = (id: string): Part => ({ id, kind: "text", text: id });
const tool = (callId: string, name = "connector.google.gmail.searchMessages"): Part => ({
	id: callId,
	kind: "tool",
	tool: { callId, tool: name },
});
const other = (id: string): Part => ({ id, kind: "input-request" });

describe("groupParts", () => {
	const toolCount = (block: RenderBlock<Part> | undefined): number =>
		block && block.kind === "tools" ? block.tools.length : -1;

	test("coalesces consecutive tool parts into one group keyed by the first callId", () => {
		const blocks = groupParts([tool("a"), tool("b"), tool("c")]);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ kind: "tools", groupId: "a" });
		expect(toolCount(blocks[0])).toBe(3);
	});

	test("text flushes the open group and delimits blocks", () => {
		const blocks = groupParts([text("t1"), tool("a"), tool("b"), text("t2"), tool("c")]);
		expect(blocks.map((b) => b.kind)).toEqual(["text", "tools", "text", "tools"]);
		expect(toolCount(blocks[1])).toBe(2);
		expect(toolCount(blocks[3])).toBe(1);
	});

	test("standalone tools flush the group and render on their own", () => {
		const blocks = groupParts([tool("a"), tool("draft", "email.draft.create"), tool("b")], {
			isStandalone: (p) => p.tool?.tool === "email.draft.create",
		});
		expect(blocks.map((b) => b.kind)).toEqual(["tools", "other", "tools"]);
	});

	test("non-text non-tool parts become 'other' blocks", () => {
		const blocks = groupParts([tool("a"), other("req")]);
		expect(blocks.map((b) => b.kind)).toEqual(["tools", "other"]);
	});

	test("groupId is stable when a trailing text block is appended (sticky-expand premise)", () => {
		const before = groupParts([tool("x"), tool("y")]);
		const after = groupParts([tool("x"), tool("y"), text("t")]);
		const groupBefore = before[0];
		const groupAfter = after[0];
		expect(groupBefore?.kind === "tools" && groupBefore.groupId).toBe("x");
		expect(groupAfter?.kind === "tools" && groupAfter.groupId).toBe("x");
	});
});

describe("toolGroupMode", () => {
	test("user expansion wins", () => {
		expect(toolGroupMode({ isActive: true, userExpanded: true })).toBe("expanded");
		expect(toolGroupMode({ isActive: false, userExpanded: true })).toBe("expanded");
	});
	test("active streaming group slides; settled collapses", () => {
		expect(toolGroupMode({ isActive: true, userExpanded: false })).toBe("sliding");
		expect(toolGroupMode({ isActive: false, userExpanded: false })).toBe("collapsed");
	});
});

describe("visibleTools", () => {
	const five = ["a", "b", "c", "d", "e"];
	test("sliding shows the most recent window", () => {
		expect(visibleTools(five, "sliding")).toEqual(["c", "d", "e"]);
	});
	test("expanded shows all; collapsed shows none", () => {
		expect(visibleTools(five, "expanded")).toEqual(five);
		expect(visibleTools(five, "collapsed")).toEqual([]);
	});
	test("sliding with fewer than the window shows all", () => {
		expect(visibleTools(["a", "b"], "sliding")).toEqual(["a", "b"]);
	});
});
