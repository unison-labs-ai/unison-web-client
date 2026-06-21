// Run-detail sections (spec §6): scorecard, baseline comparison, cost/token
// charts, tool-call waterfall, failures, review queue, candidate metadata and
// retention state. The run-item table lives in run-items-table.tsx.

import type { EvalRunDetailResponse, EvalRunItemWire, EvalRunWire } from "@unison/contracts";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { formatCostMicros, formatDelta, formatScore, formatTokens } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { GroupRow } from "@/ui/page-blocks";
import { cn } from "@/ui/utils";
import { ChartEmpty, MiniBarChart, MiniLineChart, ScoreBarList, StackedBar } from "./charts";
import { DetailSection, SectionBody } from "./display";
import {
	type BaselineRow,
	buildBaselineRows,
	buildItemSeries,
	type ReviewQueueEntry,
	selectReviewQueue,
} from "./eval-metrics";
import { ITEM_STATUS_BADGE_VARIANT, statusLabel } from "./eval-status";

// ---------------------------------------------------------------------------
// Scorecard by category and dimension
// ---------------------------------------------------------------------------

export function ScorecardSection({ run }: { run: EvalRunWire }) {
	const summary = run.summary;
	const categories = summary
		? Object.entries(summary.categoryScores).map(([label, value]) => ({
				delta: summary.baseline?.categoryDeltas[label] ?? null,
				label,
				value,
			}))
		: [];
	const dimensions = summary
		? Object.entries(summary.dimensionScores).map(([label, value]) => ({
				delta: summary.baseline?.dimensionDeltas[label] ?? null,
				label,
				value,
			}))
		: [];
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<DetailSection title="Scorecard by category">
				<SectionBody>
					<ScoreBarList emptyLabel="Scores appear once grading completes." items={categories} />
				</SectionBody>
			</DetailSection>
			<DetailSection title="Scorecard by dimension">
				<SectionBody>
					<ScoreBarList emptyLabel="Scores appear once grading completes." items={dimensions} />
				</SectionBody>
			</DetailSection>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Baseline comparison
// ---------------------------------------------------------------------------

function BaselineRowView({ row }: { row: BaselineRow }) {
	const format = row.kind === "cost" ? formatCostMicros : formatScore;
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_72px_72px_84px] items-baseline gap-2 text-xs">
			<span className="text-ink-muted truncate" title={row.label}>
				{row.label}
			</span>
			<span className="text-ink text-right tabular-nums">{format(row.currentValue)}</span>
			<span className="text-ink-subtle text-right tabular-nums">{format(row.baselineValue)}</span>
			<span
				className={cn(
					"text-right tabular-nums",
					row.delta === null || row.delta === 0
						? "text-ink-subtle"
						: (row.kind === "cost" ? row.delta < 0 : row.delta > 0)
							? "text-ink-muted"
							: "text-danger",
				)}
			>
				{formatDelta(row.delta, format)}
			</span>
		</div>
	);
}

export function BaselineSection({ detail }: { detail: EvalRunDetailResponse }) {
	const rows = buildBaselineRows(detail.run, detail.baseline);
	return (
		<DetailSection title="Baseline comparison">
			<SectionBody>
				{rows.length === 0 ? (
					<ChartEmpty label="No baseline recorded for this run." />
				) : (
					<div className="flex flex-col gap-1.5">
						{detail.baseline && (
							<p className="text-ink-subtle m-0 mb-1 text-xs">
								vs{" "}
								<Link
									className="text-ink-muted no-underline hover:text-ink"
									href={`/observability/runs/${detail.baseline.id}`}
								>
									{detail.baseline.title}
								</Link>
							</p>
						)}
						<div className="text-ink-subtle grid grid-cols-[minmax(0,1fr)_72px_72px_84px] gap-2 text-[10px] uppercase">
							<span />
							<span className="text-right">current</span>
							<span className="text-right">baseline</span>
							<span className="text-right">delta</span>
						</div>
						{rows.map((row) => (
							<BaselineRowView key={row.label} row={row} />
						))}
					</div>
				)}
			</SectionBody>
		</DetailSection>
	);
}

// ---------------------------------------------------------------------------
// Cost and token charts over time
// ---------------------------------------------------------------------------

export function UsageChartsSection({ items }: { items: EvalRunItemWire[] }) {
	const series = buildItemSeries(items);
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<DetailSection title="Cost over time (cumulative)">
				<SectionBody>
					<MiniLineChart
						emptyLabel="No completed items with usage yet."
						formatValue={formatCostMicros}
						points={series.map((point) => ({
							label: point.caseId,
							value: point.cumulativeCostMicros,
						}))}
						title="Cumulative cost across completed items"
					/>
				</SectionBody>
			</DetailSection>
			<DetailSection title="Tokens per item">
				<SectionBody>
					<MiniBarChart
						emptyLabel="No completed items with usage yet."
						formatValue={formatTokens}
						points={series.map((point) => ({ label: point.caseId, value: point.totalTokens }))}
						title="Total tokens per completed item"
					/>
				</SectionBody>
			</DetailSection>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Tool-call waterfall
// ---------------------------------------------------------------------------

export function ToolWaterfallSection({ items }: { items: EvalRunItemWire[] }) {
	const rows = items.flatMap((item) =>
		item.usage ? [{ caseId: item.caseId, id: item.id, trial: item.trial, usage: item.usage }] : [],
	);
	const max = rows.reduce((acc, row) => Math.max(acc, row.usage.toolCalls), 0);
	return (
		<DetailSection title="Tool-call waterfall">
			<SectionBody>
				{rows.length === 0 ? (
					<ChartEmpty label="No tool usage reported yet." />
				) : (
					<div className="flex flex-col gap-1.5">
						{rows.map((row) => (
							<div className="flex items-center gap-2" key={row.id}>
								<span
									className="text-ink-muted w-32 shrink-0 truncate font-mono text-[11px]"
									title={`${row.caseId} (trial ${row.trial})`}
								>
									{row.caseId}
								</span>
								<div className="min-w-0 flex-1">
									<StackedBar
										max={max}
										segments={[
											{
												color: "var(--ink-subtle)",
												label: "succeeded",
												value: row.usage.toolCalls - row.usage.failedToolCalls,
											},
											{ color: "var(--danger)", label: "failed", value: row.usage.failedToolCalls },
										]}
										title={`${row.caseId}: ${row.usage.toolCalls} calls, ${row.usage.failedToolCalls} failed`}
									/>
								</div>
								<span className="text-ink-subtle w-44 shrink-0 text-right text-[11px] tabular-nums">
									{row.usage.toolCalls} calls · {row.usage.failedToolCalls} failed ·{" "}
									{row.usage.duplicateToolCalls} dup
								</span>
							</div>
						))}
					</div>
				)}
			</SectionBody>
		</DetailSection>
	);
}

// ---------------------------------------------------------------------------
// Failures and warnings
// ---------------------------------------------------------------------------

export function FailuresSection({ items }: { items: EvalRunItemWire[] }) {
	const flagged = items.filter(
		(item) =>
			item.verdict === "fail" || item.verdict === "warn" || item.criticalFailures.length > 0,
	);
	return (
		<DetailSection title="Failures and warnings">
			{flagged.length === 0 ? (
				<SectionBody>
					<ChartEmpty label="No failures or warnings." />
				</SectionBody>
			) : (
				flagged.map((item) => (
					<div className="flex flex-col gap-1 px-4 py-3" key={item.id}>
						<div className="flex items-center gap-2">
							{item.verdict && (
								<Badge variant={item.verdict === "fail" ? "danger" : "warning"}>
									{item.verdict}
								</Badge>
							)}
							<Badge variant={ITEM_STATUS_BADGE_VARIANT[item.status]}>
								{statusLabel(item.status)}
							</Badge>
							<span className="text-ink min-w-0 truncate text-xs font-medium">
								{item.caseTitle}
							</span>
							<span className="text-ink-subtle ml-auto shrink-0 font-mono text-[11px]">
								{item.caseId}
							</span>
						</div>
						{item.criticalFailures.length > 0 && (
							<p className="text-danger m-0 flex items-center gap-1 text-xs">
								<AlertTriangle size={12} />
								{item.criticalFailures.join(", ")}
							</p>
						)}
						{item.error && <p className="text-ink-muted m-0 text-xs">{item.error}</p>}
					</div>
				))
			)}
		</DetailSection>
	);
}

// ---------------------------------------------------------------------------
// Judge disagreement and human-review queue
// ---------------------------------------------------------------------------

export function ReviewQueueSection({ detail }: { detail: EvalRunDetailResponse }) {
	const queue: ReviewQueueEntry[] = selectReviewQueue(detail.items, detail.scores);
	return (
		<DetailSection title="Judge disagreement and human-review queue">
			{queue.length === 0 ? (
				<SectionBody>
					<ChartEmpty label="Nothing queued for human review." />
				</SectionBody>
			) : (
				queue.map(({ item, reasons }) => (
					<div className="flex flex-col gap-1 px-4 py-3" key={item.id}>
						<div className="flex items-center gap-2">
							<span className="text-ink min-w-0 truncate text-xs font-medium">
								{item.caseTitle}
							</span>
							<span className="text-ink-subtle shrink-0 font-mono text-[11px]">{item.caseId}</span>
							{item.threadId && (
								<Link
									className="text-ink-muted ml-auto shrink-0 text-xs no-underline hover:text-ink"
									href={`/sessions/${item.threadId}`}
								>
									View session →
								</Link>
							)}
						</div>
						<div className="flex flex-wrap gap-1">
							{reasons.map((reason) => (
								<span
									className="bg-warning-soft text-warning rounded-pill px-1.5 py-px text-[10px]"
									key={reason}
								>
									{reason}
								</span>
							))}
						</div>
					</div>
				))
			)}
		</DetailSection>
	);
}

// ---------------------------------------------------------------------------
// Candidate metadata + retention state
// ---------------------------------------------------------------------------

export function CandidateSection({ run }: { run: EvalRunWire }) {
	const candidate = run.candidate;
	const rows: Array<[string, string | null | undefined]> = [
		["Provider", candidate.provider],
		["Model", candidate.model],
		["Model selector", candidate.modelSelectorVersion],
		["System prompt hash", candidate.systemPromptHash],
		["Tool catalog hash", candidate.toolCatalogHash],
		["Runbook compiler hash", candidate.runbookCompilerHash],
		["Memory policy", candidate.memoryPolicyVersion],
		["Compaction policy", candidate.compactionPolicyVersion],
		["Connector fixtures", candidate.connectorFixtureVersion],
		["Budget profile", candidate.budgetProfile],
		["Code revision", candidate.codeRevision],
		["Judge model", candidate.judgeModel],
		["Price table version", candidate.priceTableVersion],
		["Config hash", run.candidateConfigHash],
	];
	return (
		<DetailSection title="Candidate metadata">
			{rows.map(([label, value]) => (
				<GroupRow key={label} title={label}>
					<span className="text-ink-muted max-w-full break-all text-right font-mono text-xs">
						{value || "—"}
					</span>
				</GroupRow>
			))}
		</DetailSection>
	);
}

export function RetentionSection({ run }: { run: EvalRunWire }) {
	return (
		<DetailSection title="Cleanup and retention">
			<GroupRow title="Retention policy">
				<span className="text-ink-muted text-xs">{statusLabel(run.retentionPolicy)}</span>
			</GroupRow>
			<GroupRow title="Retain until">
				<span className="text-ink-muted text-xs">
					{run.retainUntil ? new Date(run.retainUntil).toLocaleString() : "—"}
				</span>
			</GroupRow>
			<GroupRow title="Cleanup state">
				<Badge variant={run.cleanupState === "skipped" ? "warning" : "default"}>
					{run.cleanupState}
				</Badge>
			</GroupRow>
			<GroupRow title="Environment">
				<span className="text-ink-muted text-xs">{run.environment}</span>
			</GroupRow>
			{run.error && (
				<GroupRow danger title="Run error">
					<span className="text-ink-muted max-w-full break-all text-right text-xs">
						{run.error}
					</span>
				</GroupRow>
			)}
		</DetailSection>
	);
}
