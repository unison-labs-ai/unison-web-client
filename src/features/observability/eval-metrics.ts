import type { EvalRunItemWire, EvalRunWire, EvalScoreWire } from "@unison/contracts";

import { isRunActive } from "./eval-status";

// Pure selectors behind the dashboard screens (spec §6). All of these compute
// from the wire payloads only — missing data stays null so the UI renders an
// em-dash instead of fabricating numbers.

// ---------------------------------------------------------------------------
// Top cards (run list screen)
// ---------------------------------------------------------------------------

export type RunCards = {
	activeItems: number;
	activeRuns: number;
	averageScore: number | null;
	costBaselineDeltaMicros: number | null;
	criticalFailures: number;
	longestActiveMs: number | null;
	passRate: number | null;
	/** p50/p95 come from the most recent run carrying runtime stats — per-run
	 * percentiles cannot be combined honestly across runs. */
	runtimeP50Ms: number | null;
	runtimeP95Ms: number | null;
	scoreBaselineDelta: number | null;
	tokens: {
		cached: number;
		estimatedInput: number;
		input: number;
		output: number;
		reasoning: number;
		total: number;
	} | null;
	tools: { duplicate: number; failed: number; total: number } | null;
	totalCostMicros: number | null;
};

function recencyKey(run: EvalRunWire): string {
	return run.completedAt ?? run.startedAt ?? run.createdAt;
}

export function aggregateRunCards(runs: EvalRunWire[], now: number): RunCards {
	const activeRuns = runs.filter((run) => isRunActive(run.status));
	const summaries = runs.flatMap((run) => (run.summary ? [run.summary] : []));

	const scores = summaries
		.map((summary) => summary.aggregateScore)
		.filter((score): score is number => score !== null);
	const averageScore =
		scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

	// Pass rate weighted by run size, so a 70-case nightly outweighs a 3-case
	// targeted run.
	let passSum = 0;
	let passWeight = 0;
	for (const run of runs) {
		const passRate = run.summary?.passRate;
		if (passRate === null || passRate === undefined) continue;
		const weight = run.itemCounts.total > 0 ? run.itemCounts.total : 1;
		passSum += passRate * weight;
		passWeight += weight;
	}
	const passRate = passWeight > 0 ? passSum / passWeight : null;

	const criticalFailures = summaries.reduce(
		(sum, summary) => sum + summary.criticalFailureCount,
		0,
	);

	const tokens =
		summaries.length > 0
			? summaries.reduce(
					(acc, summary) => ({
						cached: acc.cached + summary.usage.cachedTokens,
						estimatedInput: acc.estimatedInput + summary.usage.estimatedInputTokens,
						input: acc.input + summary.usage.inputTokens,
						output: acc.output + summary.usage.outputTokens,
						reasoning: acc.reasoning + summary.usage.reasoningTokens,
						total: acc.total + summary.usage.totalTokens,
					}),
					{ cached: 0, estimatedInput: 0, input: 0, output: 0, reasoning: 0, total: 0 },
				)
			: null;

	const tools =
		summaries.length > 0
			? summaries.reduce(
					(acc, summary) => ({
						duplicate: acc.duplicate + summary.usage.duplicateToolCalls,
						failed: acc.failed + summary.usage.failedToolCalls,
						total: acc.total + summary.usage.toolCalls,
					}),
					{ duplicate: 0, failed: 0, total: 0 },
				)
			: null;

	const totalCostMicros =
		summaries.length > 0
			? summaries.reduce((sum, summary) => sum + summary.usage.costMicros, 0)
			: null;

	// Baseline deltas surface from the latest completed run that carries one.
	const latestBaselined = runs
		.filter((run) => run.status === "completed" && run.summary?.baseline)
		.sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))[0];
	const scoreBaselineDelta = latestBaselined?.summary?.baseline?.aggregateDelta ?? null;
	const costBaselineDeltaMicros = latestBaselined?.summary?.baseline?.costDeltaMicros ?? null;

	const latestRuntime = runs
		.filter(
			(run) =>
				run.summary !== null &&
				(run.summary.runtime.p50Ms !== null || run.summary.runtime.p95Ms !== null),
		)
		.sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))[0];

	let longestActiveMs: number | null = null;
	for (const run of activeRuns) {
		if (!run.startedAt) continue;
		const elapsed = now - Date.parse(run.startedAt);
		if (!Number.isFinite(elapsed)) continue;
		longestActiveMs = Math.max(longestActiveMs ?? 0, elapsed);
	}

	return {
		activeItems: activeRuns.reduce((sum, run) => sum + run.itemCounts.active, 0),
		activeRuns: activeRuns.length,
		averageScore,
		costBaselineDeltaMicros,
		criticalFailures,
		longestActiveMs,
		passRate,
		runtimeP50Ms: latestRuntime?.summary?.runtime.p50Ms ?? null,
		runtimeP95Ms: latestRuntime?.summary?.runtime.p95Ms ?? null,
		scoreBaselineDelta,
		tokens,
		tools,
		totalCostMicros,
	};
}

// ---------------------------------------------------------------------------
// Judge disagreement / human-review queue (run detail)
// ---------------------------------------------------------------------------

export type ReviewQueueEntry = { item: EvalRunItemWire; reasons: string[] };

const JUDGE_CONFIDENCE_FLOOR = 0.5;

/** Scores can arrive on a 0–1 or 0–100 scale; the spec's ">30 gap" applies on
 * the percent scale, so detect the scale and use 0.3 on the fractional one. */
function judgeGapThreshold(scores: EvalScoreWire[]): number {
	const comparable = scores.filter(
		(score) => score.grader === "judge" || score.grader === "deterministic",
	);
	return comparable.some((score) => Math.abs(score.score) > 1.5) ? 30 : 0.3;
}

/** Items needing a human look: low judge confidence, a judge/deterministic
 * dimension gap where both graders scored the same component, or any critical
 * failure (spec §9 step 8). */
export function selectReviewQueue(
	items: EvalRunItemWire[],
	scores: EvalScoreWire[],
): ReviewQueueEntry[] {
	const byItem = new Map<string, EvalScoreWire[]>();
	for (const score of scores) {
		const list = byItem.get(score.runItemId);
		if (list) {
			list.push(score);
		} else {
			byItem.set(score.runItemId, [score]);
		}
	}
	const gapThreshold = judgeGapThreshold(scores);

	const entries: ReviewQueueEntry[] = [];
	for (const item of items) {
		const reasons: string[] = [];
		const itemScores = byItem.get(item.id) ?? [];
		const judgeRows = itemScores.filter((score) => score.grader === "judge");

		for (const row of judgeRows) {
			const confidence = row.detail.confidence;
			if (typeof confidence === "number" && confidence < JUDGE_CONFIDENCE_FLOOR) {
				reasons.push(`Low judge confidence (${confidence.toFixed(2)})`);
				break;
			}
		}

		const judgeByComponent = new Map(judgeRows.map((score) => [score.component, score.score]));
		for (const det of itemScores) {
			if (det.grader !== "deterministic") continue;
			const judgeScore = judgeByComponent.get(det.component);
			if (judgeScore === undefined) continue;
			const gap = Math.abs(judgeScore - det.score);
			if (gap > gapThreshold) {
				reasons.push(`Judge/deterministic gap on ${det.component} (${gap.toFixed(2)})`);
				break;
			}
		}

		if (item.criticalFailures.length > 0) {
			reasons.push(`Critical: ${item.criticalFailures.join(", ")}`);
		}

		if (reasons.length > 0) {
			entries.push({ item, reasons });
		}
	}
	return entries;
}

// ---------------------------------------------------------------------------
// Per-item series (cost/token charts over time, run detail)
// ---------------------------------------------------------------------------

export type ItemSeriesPoint = {
	caseId: string;
	completedAt: string;
	costMicros: number;
	cumulativeCostMicros: number;
	totalTokens: number;
};

export function buildItemSeries(items: EvalRunItemWire[]): ItemSeriesPoint[] {
	const done = items
		.flatMap((item) =>
			item.completedAt && item.usage
				? [{ caseId: item.caseId, completedAt: item.completedAt, usage: item.usage }]
				: [],
		)
		.sort((a, b) => a.completedAt.localeCompare(b.completedAt));

	let cumulative = 0;
	return done.map((entry) => {
		cumulative += entry.usage.costMicros;
		return {
			caseId: entry.caseId,
			completedAt: entry.completedAt,
			costMicros: entry.usage.costMicros,
			cumulativeCostMicros: cumulative,
			totalTokens: entry.usage.totalTokens,
		};
	});
}

// ---------------------------------------------------------------------------
// Baseline comparison rows (run detail)
// ---------------------------------------------------------------------------

export type BaselineRow = {
	baselineValue: number | null;
	currentValue: number | null;
	delta: number | null;
	kind: "cost" | "score";
	label: string;
};

export function buildBaselineRows(
	run: EvalRunWire,
	baselineRun: EvalRunWire | null,
): BaselineRow[] {
	const summary = run.summary;
	const base = summary?.baseline;
	if (!summary || !base) return [];

	const rows: BaselineRow[] = [
		{
			baselineValue: baselineRun?.summary?.aggregateScore ?? null,
			currentValue: summary.aggregateScore,
			delta: base.aggregateDelta,
			kind: "score",
			label: "Aggregate",
		},
	];
	for (const [category, delta] of Object.entries(base.categoryDeltas)) {
		rows.push({
			baselineValue: baselineRun?.summary?.categoryScores[category] ?? null,
			currentValue: summary.categoryScores[category] ?? null,
			delta,
			kind: "score",
			label: `Category · ${category}`,
		});
	}
	for (const [dimension, delta] of Object.entries(base.dimensionDeltas)) {
		rows.push({
			baselineValue: baselineRun?.summary?.dimensionScores[dimension] ?? null,
			currentValue: summary.dimensionScores[dimension] ?? null,
			delta,
			kind: "score",
			label: `Dimension · ${dimension}`,
		});
	}
	rows.push({
		baselineValue: baselineRun?.summary?.usage.costMicros ?? null,
		currentValue: summary.usage.costMicros,
		delta: base.costDeltaMicros,
		kind: "cost",
		label: "Cost",
	});
	return rows;
}

// ---------------------------------------------------------------------------
// Tool-call hygiene
// ---------------------------------------------------------------------------

/** More than two duplicate calls in one item smells like a retry loop. */
export const SUSPICIOUS_DUPLICATE_THRESHOLD = 2;

export function hasSuspiciousLoop(duplicateToolCalls: number): boolean {
	return duplicateToolCalls > SUSPICIOUS_DUPLICATE_THRESHOLD;
}
