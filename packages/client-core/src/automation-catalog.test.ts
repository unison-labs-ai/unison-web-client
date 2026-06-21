import { describe, expect, test } from "bun:test";
import type { AutomationTemplate, AutomationWithRelations } from "@unison/contracts";

import { mergeAutomationCatalog } from "./automation-catalog";

function realAutomation(id: string, templateKey: string | null): AutomationWithRelations {
	return { automation: { id, templateKey } } as unknown as AutomationWithRelations;
}

function template(key: string, overrides: Partial<AutomationTemplate> = {}): AutomationTemplate {
	return {
		available: true,
		isDefault: true,
		key,
		status: "available",
		...overrides,
	} as unknown as AutomationTemplate;
}

describe("mergeAutomationCatalog", () => {
	test("lists real automations first, then unmaterialized defaults", () => {
		const catalog = mergeAutomationCatalog(
			[realAutomation("a1", null)],
			[template("morning-briefing"), template("auto-inbox")],
		);
		expect(catalog.map((entry) => entry.kind)).toEqual(["real", "default", "default"]);
	});

	test("de-dupes a default that is already materialized (by templateKey)", () => {
		const catalog = mergeAutomationCatalog(
			[realAutomation("a1", "auto-inbox")],
			[template("auto-inbox"), template("morning-briefing")],
		);
		const defaultKeys = catalog
			.filter((entry) => entry.kind === "default")
			.map((entry) => (entry.kind === "default" ? entry.template.key : null));
		expect(defaultKeys).toEqual(["morning-briefing"]);
		expect(catalog).toHaveLength(2);
	});

	test("excludes non-default, unavailable, and disabled templates", () => {
		const catalog = mergeAutomationCatalog(
			[],
			[
				template("agent-only", { isDefault: false }),
				template("coming-soon", { available: false }),
				template("disabled-template", { status: "disabled" }),
				template("shown"),
			],
		);
		expect(catalog).toHaveLength(1);
		const [entry] = catalog;
		expect(entry?.kind).toBe("default");
		if (entry?.kind === "default") {
			expect(entry.template.key).toBe("shown");
		}
	});
});
