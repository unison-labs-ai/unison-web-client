import { describe, expect, it } from "bun:test";
import type {
	EvalRunItemWire,
	EvalRunSummaryWire,
	EvalRunWire,
	EvalScoreWire,
} from "@unison/contracts";

import {
	aggregateRunCards,
	buildBaselineRows,
	buildItemSeries,
	hasSuspiciousLoop,
	selectReviewQueue,
} from "./eval-metrics";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const BASELINE_RUN_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ITEM_ID = "44444444-4444-4444-8444-444444444444";
const SCORE_ID = "55555555-5555-4555-8555-555555555555";

function makeSummary(overrides: Partial<EvalRunSummaryWire> = {}): EvalRunSummaryWire {
	return {
		aggregateScore: 0.8,
		baseline: null,
		categoryScores: { automation: 0.9 },
		criticalFailureCount: 0,
		dimensionScores: { outcome: 0.85 },
		passRate: 0.75,
		runtime: { longestMs: 90_000, p50Ms: 30_000, p95Ms: 80_000 },
		usage: {
			cachedTokens: 100,
			costMicros: 250_000,
			duplicateToolCalls: 1,
			estimatedInputTokens: 900,
			failedToolCalls: 2,
			inputTokens: 1000,
			modelCalls: 10,
			outputTokens: 500,
			reasoningTokens: 200,
			toolCalls: 20,
			totalTokens: 1800,
		},
		...overrides,
	};
}

function makeRun(overrides: Partial<EvalRunWire> = {}): EvalRunWire {
	return {
		baselineRunId: null,
		candidate: { budgetProfile: "default", model: "test-model", provider: "test" },
		candidateConfigHash: "abcdef1234567890",
		cleanupState: "pending",
		completedAt: null,
		createdAt: "2026-06-11T10:00:00.000Z",
		environment: "ci",
		error: null,
		id: RUN_ID,
		itemCounts: { active: 0, completed: 4, failed: 0, total: 4 },
		latestSummary: null,
		retainUntil: null,
		retentionPolicy: "delete_after_window",
		startedAt: null,
		startedByEmail: "ops@unisonlabs.ai",
		startedByScheduler: false,
		status: "completed",
		suiteId: "smoke",
		summary: null,
		title: "Smoke run",
		...overrides,
	};
}

function makeItem(overrides: Partial<EvalRunItemWire> = {}): EvalRunItemWire {
	return {
		caseId: "auto-01",
		caseTitle: "Automation case",
		caseVersion: 1,
		category: "automation",
		completedAt: null,
		createdAt: "2026-06-11T10:00:00.000Z",
		criticalFailures: [],
		dimensionScores: null,
		error: null,
		id: ITEM_ID,
		latestSummary: null,
		runId: RUN_ID,
		runtimeMs: null,
		score: null,
		sessionId: null,
		startedAt: null,
		status: "completed",
		threadId: null,
		trial: 1,
		usage: null,
		verdict: null,
		...overrides,
	};
}

function makeScore(overrides: Partial<EvalScoreWire> = {}): EvalScoreWire {
	return {
		component: "outcome",
		createdAt: "2026-06-11T10:05:00.000Z",
		detail: {},
		grader: "deterministic",
		id: SCORE_ID,
		judgeModel: null,
		judgePromptVersion: null,
		passed: true,
		runItemId: ITEM_ID,
		score: 0.9,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// aggregateRunCards
// ---------------------------------------------------------------------------

describe("aggregateRunCards", () => {
	const now = Date.parse("2026-06-11T12:00:00.000Z");

	it("returns null metrics when no run has a summary", () => {
		const cards = aggregateRunCards([makeRun()], now);
		expect(cards.averageScore).toBeNull();
		expect(cards.passRate).toBeNull();
		expect(cards.tokens).toBeNull();
		expect(cards.tools).toBeNull();
		expect(cards.totalCostMicros).toBeNull();
		expect(cards.runtimeP50Ms).toBeNull();
		expect(cards.longestActiveMs).toBeNull();
		expect(cards.criticalFailures).toBe(0);
	});

	it("counts active runs and their active items, and the longest active elapsed", () => {
		const active = makeRun({
			itemCounts: { active: 3, completed: 1, failed: 0, total: 4 },
			startedAt: "2026-06-11T11:30:00.000Z",
			status: "running",
		});
		const cards = aggregateRunCards([active, makeRun()], now);
		expect(cards.activeRuns).toBe(1);
		expect(cards.activeItems).toBe(3);
		expect(cards.longestActiveMs).toBe(30 * 60_000);
	});

	it("aggregates scores, cost, tokens, tools and critical failures across summaries", () => {
		const runA = makeRun({ summary: makeSummary({ aggregateScore: 0.8 }) });
		const runB = makeRun({
			id: BASELINE_RUN_ID,
			summary: makeSummary({ aggregateScore: 0.6, criticalFailureCount: 2 }),
		});
		const cards = aggregateRunCards([runA, runB], now);
		expect(cards.averageScore).toBeCloseTo(0.7);
		expect(cards.totalCostMicros).toBe(500_000);
		expect(cards.tokens?.total).toBe(3600);
		expect(cards.tokens?.estimatedInput).toBe(1800);
		expect(cards.tools).toEqual({ duplicate: 2, failed: 4, total: 40 });
		expect(cards.criticalFailures).toBe(2);
	});

	it("weights pass rate by run size", () => {
		const small = makeRun({
			itemCounts: { active: 0, completed: 1, failed: 0, total: 1 },
			summary: makeSummary({ passRate: 0 }),
		});
		const large = makeRun({
			id: BASELINE_RUN_ID,
			itemCounts: { active: 0, completed: 9, failed: 0, total: 9 },
			summary: makeSummary({ passRate: 1 }),
		});
		const cards = aggregateRunCards([small, large], now);
		expect(cards.passRate).toBeCloseTo(0.9);
	});

	it("surfaces baseline deltas from the most recent completed baselined run", () => {
		const older = makeRun({
			completedAt: "2026-06-10T10:00:00.000Z",
			summary: makeSummary({
				baseline: {
					aggregateDelta: -0.5,
					categoryDeltas: {},
					costDeltaMicros: -100,
					dimensionDeltas: {},
					runId: BASELINE_RUN_ID,
				},
			}),
		});
		const newer = makeRun({
			completedAt: "2026-06-11T10:00:00.000Z",
			id: BASELINE_RUN_ID,
			summary: makeSummary({
				baseline: {
					aggregateDelta: 0.04,
					categoryDeltas: {},
					costDeltaMicros: 12_000,
					dimensionDeltas: {},
					runId: RUN_ID,
				},
			}),
		});
		const cards = aggregateRunCards([older, newer], now);
		expect(cards.scoreBaselineDelta).toBeCloseTo(0.04);
		expect(cards.costBaselineDeltaMicros).toBe(12_000);
	});
});

// ---------------------------------------------------------------------------
// selectReviewQueue
// ---------------------------------------------------------------------------

describe("selectReviewQueue", () => {
	it("returns nothing when no item needs review", () => {
		expect(selectReviewQueue([makeItem()], [makeScore()])).toEqual([]);
	});

	it("flags low judge confidence", () => {
		const scores = [
			makeScore({ detail: { confidence: 0.4 }, grader: "judge", judgeModel: "judge-1" }),
		];
		const queue = selectReviewQueue([makeItem()], scores);
		expect(queue).toHaveLength(1);
		expect(queue[0]?.reasons[0]).toContain("Low judge confidence (0.40)");
	});

	it("flags a judge/deterministic gap on the fractional scale", () => {
		const scores = [
			makeScore({ component: "outcome", grader: "deterministic", score: 0.9 }),
			makeScore({ component: "outcome", grader: "judge", judgeModel: "judge-1", score: 0.5 }),
		];
		const queue = selectReviewQueue([makeItem()], scores);
		expect(queue).toHaveLength(1);
		expect(queue[0]?.reasons[0]).toContain("Judge/deterministic gap on outcome");
	});

	it("uses the >30 threshold when scores are on the percent scale", () => {
		const smallGap = [
			makeScore({ component: "outcome", grader: "deterministic", score: 90 }),
			makeScore({ component: "outcome", grader: "judge", judgeModel: "judge-1", score: 70 }),
		];
		expect(selectReviewQueue([makeItem()], smallGap)).toEqual([]);

		const bigGap = [
			makeScore({ component: "outcome", grader: "deterministic", score: 90 }),
			makeScore({ component: "outcome", grader: "judge", judgeModel: "judge-1", score: 40 }),
		];
		expect(selectReviewQueue([makeItem()], bigGap)).toHaveLength(1);
	});

	it("flags critical failures with their reasons", () => {
		const item = makeItem({ criticalFailures: ["unapproved_external_send"] });
		const queue = selectReviewQueue([item], []);
		expect(queue).toHaveLength(1);
		expect(queue[0]?.reasons[0]).toBe("Critical: unapproved_external_send");
	});

	it("only matches scores belonging to the item", () => {
		const scores = [
			makeScore({
				detail: { confidence: 0.1 },
				grader: "judge",
				judgeModel: "judge-1",
				runItemId: OTHER_ITEM_ID,
			}),
		];
		expect(selectReviewQueue([makeItem()], scores)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildItemSeries
// ---------------------------------------------------------------------------

describe("buildItemSeries", () => {
	it("orders completed items by completion time and accumulates cost", () => {
		const usage = {
			cachedTokens: 0,
			costMicros: 100,
			duplicateToolCalls: 0,
			failedToolCalls: 0,
			inputTokens: 10,
			modelCalls: 1,
			outputTokens: 5,
			reasoningTokens: 0,
			toolCalls: 1,
			totalTokens: 15,
		};
		const items = [
			makeItem({ caseId: "b", completedAt: "2026-06-11T10:02:00.000Z", usage }),
			makeItem({
				caseId: "a",
				completedAt: "2026-06-11T10:01:00.000Z",
				id: OTHER_ITEM_ID,
				usage: { ...usage, costMicros: 50 },
			}),
			makeItem({ caseId: "skipped-no-usage" }),
		];
		const series = buildItemSeries(items);
		expect(series.map((point) => point.caseId)).toEqual(["a", "b"]);
		expect(series.map((point) => point.cumulativeCostMicros)).toEqual([50, 150]);
	});
});

// ---------------------------------------------------------------------------
// buildBaselineRows
// ---------------------------------------------------------------------------

describe("buildBaselineRows", () => {
	it("returns nothing without a baseline summary", () => {
		expect(buildBaselineRows(makeRun({ summary: makeSummary() }), null)).toEqual([]);
	});

	it("builds aggregate, category, dimension and cost rows", () => {
		const run = makeRun({
			summary: makeSummary({
				baseline: {
					aggregateDelta: 0.05,
					categoryDeltas: { automation: 0.1 },
					costDeltaMicros: -50_000,
					dimensionDeltas: { outcome: -0.02 },
					runId: BASELINE_RUN_ID,
				},
			}),
		});
		const baselineRun = makeRun({
			id: BASELINE_RUN_ID,
			summary: makeSummary({ aggregateScore: 0.75 }),
		});
		const rows = buildBaselineRows(run, baselineRun);
		expect(rows.map((row) => row.label)).toEqual([
			"Aggregate",
			"Category · automation",
			"Dimension · outcome",
			"Cost",
		]);
		expect(rows[0]).toMatchObject({ baselineValue: 0.75, currentValue: 0.8, delta: 0.05 });
		expect(rows[3]).toMatchObject({ delta: -50_000, kind: "cost" });
	});
});

// ---------------------------------------------------------------------------
// hasSuspiciousLoop
// ---------------------------------------------------------------------------

describe("hasSuspiciousLoop", () => {
	it("flags only above the duplicate threshold", () => {
		expect(hasSuspiciousLoop(2)).toBe(false);
		expect(hasSuspiciousLoop(3)).toBe(true);
	});
});
