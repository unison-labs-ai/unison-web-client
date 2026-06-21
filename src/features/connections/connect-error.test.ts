import { describe, expect, test } from "bun:test";
import { WebApiError } from "@/lib/api";
import { connectErrorMessage } from "./connect-error";

describe("connectErrorMessage", () => {
	test("surfaces the server's error envelope message", () => {
		const error = new WebApiError("Granola OAuth client registration failed. (HTTP 400)", 500);

		expect(connectErrorMessage(error)).toBe("Granola OAuth client registration failed. (HTTP 400)");
	});

	test("falls back to the generic copy for non-API failures", () => {
		expect(connectErrorMessage(new TypeError("fetch failed"))).toBe(
			"Failed to start connection flow. Try again.",
		);
		expect(connectErrorMessage(new WebApiError("  ", 500))).toBe(
			"Failed to start connection flow. Try again.",
		);
	});
});
