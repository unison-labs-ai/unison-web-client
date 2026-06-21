import { describe, expect, test } from "bun:test";

import {
	SKILL_BODY_MAX_CHARS,
	skillCreateRequestSchema,
	skillListItemSchema,
	skillNameSchema,
	skillUpdateRequestSchema,
} from "./skills";

describe("skill contracts", () => {
	test("name schema enforces a lowercase kebab handle", () => {
		expect(skillNameSchema.safeParse("weekly-review").success).toBe(true);
		expect(skillNameSchema.safeParse("skill1").success).toBe(true);
		expect(skillNameSchema.safeParse("Weekly Review").success).toBe(false);
		expect(skillNameSchema.safeParse("weekly_review").success).toBe(false);
		expect(skillNameSchema.safeParse("-leading").success).toBe(false);
		expect(skillNameSchema.safeParse("").success).toBe(false);
	});

	test("create request applies server-side defaults", () => {
		const parsed = skillCreateRequestSchema.parse({});

		expect(parsed.title).toBe("Untitled skill");
		expect(parsed.bodyMd).toBe("");
		expect(parsed.description).toBe("");
	});

	test("create request rejects an over-cap body", () => {
		const result = skillCreateRequestSchema.safeParse({
			bodyMd: "a".repeat(SKILL_BODY_MAX_CHARS + 1),
			title: "Too big",
		});

		expect(result.success).toBe(false);
	});

	test("update request requires at least one field besides baseVersion", () => {
		expect(skillUpdateRequestSchema.safeParse({}).success).toBe(false);
		expect(skillUpdateRequestSchema.safeParse({ baseVersion: 1 }).success).toBe(false);
		expect(skillUpdateRequestSchema.safeParse({ enabled: false }).success).toBe(true);
		expect(skillUpdateRequestSchema.safeParse({ baseVersion: 2, title: "New" }).success).toBe(true);
	});

	test("list item drops the body but keeps a length", () => {
		const base = {
			createdAt: new Date().toISOString(),
			description: "what + when",
			enabled: true,
			id: "11111111-1111-4111-8111-111111111111",
			name: "weekly-review",
			tenantId: "22222222-2222-4222-8222-222222222222",
			title: "Weekly review",
			updatedAt: new Date().toISOString(),
			userId: "33333333-3333-4333-8333-333333333333",
			version: 1,
		};
		const listItem = skillListItemSchema.parse({ ...base, bodyLength: 42 });

		expect("bodyMd" in listItem).toBe(false);
		expect(listItem.bodyLength).toBe(42);
	});
});
