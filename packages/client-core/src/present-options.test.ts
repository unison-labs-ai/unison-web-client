import { describe, expect, test } from "bun:test";

import { parsePresentOptions } from "./present-options";

describe("parsePresentOptions", () => {
	test("parses a well-formed present_options input", () => {
		const parsed = parsePresentOptions({
			options: [
				{ id: "run", label: "Run now", variant: "primary" },
				{ id: "later", label: "Not now" },
			],
			title: "Run it now?",
		});
		expect(parsed).toEqual({
			options: [
				{ description: undefined, id: "run", label: "Run now", variant: "primary" },
				{ description: undefined, id: "later", label: "Not now", variant: undefined },
			],
			title: "Run it now?",
		});
	});

	test("falls back the option id to its label when missing", () => {
		const parsed = parsePresentOptions({ options: [{ label: "Yes" }], title: "OK?" });
		expect(parsed?.options[0]?.id).toBe("Yes");
	});

	test("drops options without a label and returns null when none remain", () => {
		expect(parsePresentOptions({ options: [{ id: "x" }], title: "Pick" })).toBeNull();
	});

	test("returns null without a title or options", () => {
		expect(parsePresentOptions({ options: [{ label: "Yes" }] })).toBeNull();
		expect(parsePresentOptions({ title: "Pick" })).toBeNull();
		expect(parsePresentOptions(null)).toBeNull();
	});
});
