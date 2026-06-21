import { describe, expect, it } from "bun:test";

import { relativeTime } from "./relative-time";

// A small buffer keeps the floored minute math away from boundary flake.
function isoAgo(ms: number): string {
	return new Date(Date.now() - ms - 1_000).toISOString();
}

describe("relativeTime", () => {
	it("renders sub-minute timestamps as just now", () => {
		expect(relativeTime(isoAgo(10_000))).toBe("just now");
	});

	it("renders minutes ago under an hour", () => {
		expect(relativeTime(isoAgo(5 * 60_000))).toBe("5m ago");
	});

	it("renders hours ago under a day", () => {
		expect(relativeTime(isoAgo(3 * 3_600_000))).toBe("3h ago");
	});

	it("renders days ago beyond 24 hours", () => {
		expect(relativeTime(isoAgo(49 * 3_600_000))).toBe("2d ago");
	});
});
