import { describe, expect, it } from "bun:test";

import { emailBodyFromBodyMd } from "./trigger-reference-card";

const SYNTHESIZED_BODY_MD = [
	"# Quarterly invoice",
	"From: billing@example.com",
	"Date: 2026-06-11T09:30:00Z",
	"Thread: t-123",
	"## Preview",
	"Your invoice for June is attached. Action required.",
	"## Body",
	"Hi Raf,\n\nYour invoice for June is attached.\n\nThanks,\nBilling",
].join("\n\n");

describe("emailBodyFromBodyMd", () => {
	it("extracts the body section from a synthesized gmail document", () => {
		expect(emailBodyFromBodyMd(SYNTHESIZED_BODY_MD)).toBe(
			"Hi Raf,\n\nYour invoice for June is attached.\n\nThanks,\nBilling",
		);
	});

	it("returns null for a synthesized document without a body section", () => {
		const withoutBody = SYNTHESIZED_BODY_MD.slice(0, SYNTHESIZED_BODY_MD.indexOf("\n\n## Body"));
		expect(emailBodyFromBodyMd(withoutBody)).toBeNull();
	});

	it("passes through legacy plain-text previews", () => {
		expect(emailBodyFromBodyMd("Your invoice for June is attached.")).toBe(
			"Your invoice for June is attached.",
		);
	});

	it("returns null for missing or empty input", () => {
		expect(emailBodyFromBodyMd(null)).toBeNull();
		expect(emailBodyFromBodyMd(undefined)).toBeNull();
		expect(emailBodyFromBodyMd("   ")).toBeNull();
	});
});
