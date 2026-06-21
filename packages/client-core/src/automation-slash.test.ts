import { describe, expect, test } from "bun:test";

import {
	automationMentionColor,
	automationMentionToken,
	matchesSlashQuery,
	slashCommandQuery,
} from "./automation-slash";

describe("automation slash helpers", () => {
	test("mention token names the automation and carries its id", () => {
		expect(automationMentionToken({ id: "auto_123", name: "Morning brief" })).toBe(
			'"Morning brief" automation (automation_id: auto_123)',
		);
	});

	test("mention color is stable per id and a valid hex", () => {
		expect(automationMentionColor("auto_123")).toBe(automationMentionColor("auto_123"));
		expect(automationMentionColor("auto_123")).toMatch(/^#[0-9a-f]{6}$/);
	});

	test("slashCommandQuery detects a leading slash with no whitespace", () => {
		expect(slashCommandQuery("/")).toBe("");
		expect(slashCommandQuery("/auto")).toBe("auto");
		expect(slashCommandQuery("/automation ")).toBeNull();
		expect(slashCommandQuery("hello")).toBeNull();
		expect(slashCommandQuery("")).toBeNull();
	});

	test("matchesSlashQuery matches label and keywords case-insensitively", () => {
		const row = { keywords: ["routine", "schedule"], label: "Create automation" };
		expect(matchesSlashQuery("", row)).toBe(true);
		expect(matchesSlashQuery("auto", row)).toBe(true);
		expect(matchesSlashQuery("SCHED", row)).toBe(true);
		expect(matchesSlashQuery("xyz", row)).toBe(false);
	});
});
