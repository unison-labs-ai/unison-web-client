import { describe, expect, it } from "bun:test";

import {
	formatCostMicros,
	formatDelta,
	formatDurationMs,
	formatPercent,
	formatScore,
	formatTokens,
} from "./format";

describe("formatCostMicros", () => {
	it("renders missing values as an em-dash", () => {
		expect(formatCostMicros(null)).toBe("—");
		expect(formatCostMicros(undefined)).toBe("—");
	});

	it("renders zero as $0.00", () => {
		expect(formatCostMicros(0)).toBe("$0.00");
	});

	it("keeps four decimals below a dollar", () => {
		expect(formatCostMicros(12_300)).toBe("$0.0123");
	});

	it("keeps two decimals at a dollar and above", () => {
		expect(formatCostMicros(1_250_000)).toBe("$1.25");
		expect(formatCostMicros(123_456_789)).toBe("$123.46");
	});

	it("signs negative amounts (baseline deltas)", () => {
		expect(formatCostMicros(-12_300)).toBe("-$0.0123");
	});
});

describe("formatTokens", () => {
	it("renders missing values as an em-dash", () => {
		expect(formatTokens(null)).toBe("—");
	});

	it("keeps sub-thousand counts raw", () => {
		expect(formatTokens(843)).toBe("843");
	});

	it("abbreviates thousands and millions", () => {
		expect(formatTokens(1234)).toBe("1.2k");
		expect(formatTokens(12_000)).toBe("12k");
		expect(formatTokens(3_400_000)).toBe("3.4M");
	});

	it("abbreviates billions", () => {
		expect(formatTokens(2_500_000_000)).toBe("2.5B");
	});
});

describe("formatDurationMs", () => {
	it("renders missing values as an em-dash", () => {
		expect(formatDurationMs(null)).toBe("—");
	});

	it("renders sub-second values in milliseconds", () => {
		expect(formatDurationMs(850)).toBe("850ms");
	});

	it("renders sub-minute values in seconds", () => {
		expect(formatDurationMs(12_300)).toBe("12.3s");
		expect(formatDurationMs(12_000)).toBe("12s");
	});

	it("renders minutes with zero-padded seconds", () => {
		expect(formatDurationMs(4 * 60_000 + 5_000)).toBe("4m 05s");
	});

	it("renders hours with zero-padded minutes", () => {
		expect(formatDurationMs(72 * 60_000)).toBe("1h 12m");
		expect(formatDurationMs(60 * 60_000)).toBe("1h 00m");
	});
});

describe("formatScore", () => {
	it("renders missing values as an em-dash", () => {
		expect(formatScore(null)).toBe("—");
	});

	it("keeps two decimals on the 0-1 scale", () => {
		expect(formatScore(0.8)).toBe("0.80");
		expect(formatScore(1)).toBe("1.00");
	});

	it("rounds whole numbers on the 0-100 scale", () => {
		expect(formatScore(82.4)).toBe("82");
	});
});

describe("formatPercent", () => {
	it("renders missing values as an em-dash", () => {
		expect(formatPercent(null)).toBe("—");
	});

	it("treats values at or below one as fractions", () => {
		expect(formatPercent(0.825)).toBe("82.5%");
		expect(formatPercent(1)).toBe("100%");
	});

	it("treats values above one as percentages already", () => {
		expect(formatPercent(82.5)).toBe("82.5%");
	});
});

describe("formatDelta", () => {
	it("renders missing values as an em-dash", () => {
		expect(formatDelta(null)).toBe("—");
	});

	it("signs positive and negative deltas", () => {
		expect(formatDelta(0.04)).toBe("+0.04");
		expect(formatDelta(-0.04)).toBe("-0.04");
	});

	it("marks a zero delta explicitly", () => {
		expect(formatDelta(0)).toBe("±0.00");
	});

	it("accepts a custom formatter for cost deltas", () => {
		expect(formatDelta(-12_300, formatCostMicros)).toBe("-$0.0123");
	});
});
