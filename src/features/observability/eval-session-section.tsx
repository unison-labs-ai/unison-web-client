"use client";

import { useQuery } from "@tanstack/react-query";
import type { EvalSessionOverlayResponse } from "@unison/contracts";
import { CheckCircle2, CircleDashed, ExternalLink, Repeat2, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useApi } from "@/lib/api-context";
import {
	formatCostMicros,
	formatDurationMs,
	formatPercent,
	formatScore,
	formatTokens,
} from "@/lib/format";
import { Badge } from "@/ui/badge";
import { cn } from "@/ui/utils";
import { HashChip } from "./display";
import { hasSuspiciousLoop } from "./eval-metrics";
import {
	ITEM_STATUS_BADGE_VARIANT,
	isItemActive,
	RUN_STATUS_BADGE_VARIANT,
	statusLabel,
} from "./eval-status";
import { useInternalAccount } from "./use-internal-account";

const OVERLAY_REFETCH_MS = 5000;

// ---------------------------------------------------------------------------
// Small layout helpers (match the session panel's section style)
// ---------------------------------------------------------------------------

function SubLabel({ children }: { children: string }) {
	return (
		<p className="text-ink-subtle m-0 mb-0.5 text-[11px] uppercase tracking-wide">{children}</p>
	);
}

function Block({ children, label }: { children: ReactNode; label: string }) {
	return (
		<div>
			<SubLabel>{label}</SubLabel>
			{children}
		</div>
	);
}

function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
	const clamped = Math.min(1, Math.max(0, fraction));
	return (
		<svg className="h-1.5 w-full" preserveAspectRatio="none" role="img" viewBox="0 0 100 6">
			<title>{label}</title>
			<rect fill="var(--surface)" height="6" rx="3" width="100" />
			<rect
				fill={
					clamped >= 1 ? "var(--danger)" : clamped >= 0.8 ? "var(--warning)" : "var(--ink-subtle)"
				}
				height="6"
				rx="3"
				width={Math.max(clamped * 100, clamped > 0 ? 2 : 0)}
			/>
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Budgets — limits/used are open metadata records; render the numeric pairs
// as burn-down bars and anything else as plain text.
// ---------------------------------------------------------------------------

function BudgetRows({ budgets }: { budgets: EvalSessionOverlayResponse["budgets"] }) {
	const keys = Object.keys(budgets.limits);
	if (keys.length === 0 && budgets.status === null) {
		return <p className="text-ink-subtle m-0 text-xs">No budgets recorded.</p>;
	}
	return (
		<div className="flex flex-col gap-1.5">
			{budgets.status && (
				<Badge
					variant={
						budgets.status === "within_budget"
							? "default"
							: budgets.status === "exhausted_graceful"
								? "warning"
								: "danger"
					}
				>
					{statusLabel(budgets.status)}
				</Badge>
			)}
			{keys.map((key) => {
				const limit = budgets.limits[key];
				const used = budgets.used[key];
				if (typeof limit === "number" && limit > 0) {
					const usedValue = typeof used === "number" ? used : 0;
					return (
						<div className="flex flex-col gap-0.5" key={key}>
							<div className="text-ink-muted flex justify-between text-[11px] tabular-nums">
								<span className="font-mono">{key}</span>
								<span>
									{usedValue} / {limit} · {Math.max(0, limit - usedValue)} left
								</span>
							</div>
							<ProgressBar
								fraction={usedValue / limit}
								label={`${key}: ${usedValue} of ${limit} used`}
							/>
						</div>
					);
				}
				return (
					<p className="text-ink-muted m-0 font-mono text-[11px]" key={key}>
						{key}: {String(used ?? "—")} / {String(limit)}
					</p>
				);
			})}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Overlay body
// ---------------------------------------------------------------------------

function OverlayBody({
	overlay,
	sessionId,
}: {
	overlay: EvalSessionOverlayResponse;
	sessionId: string;
}) {
	const failedTools = overlay.toolCalls.filter((tool) => tool.failures > 0 || tool.duplicates > 0);
	return (
		<div className="bg-surface-muted flex flex-col gap-3 rounded-lg border border-(--border) p-3">
			{/* Case identity */}
			<div className="flex flex-col gap-1">
				<div className="flex flex-wrap items-center gap-1">
					<span className="bg-surface text-ink-subtle rounded-pill px-1.5 py-px font-mono text-[10px]">
						{overlay.caseId}
					</span>
					<Badge>{overlay.category}</Badge>
					<Badge>{overlay.suiteId}</Badge>
				</div>
				<p className="text-ink m-0 text-xs font-medium">{overlay.caseTitle}</p>
			</div>

			{/* Run status + candidate */}
			<Block label="Run">
				<div className="flex flex-wrap items-center gap-1.5">
					<Badge variant={RUN_STATUS_BADGE_VARIANT[overlay.runStatus]}>
						{statusLabel(overlay.runStatus)}
					</Badge>
					<Badge variant={ITEM_STATUS_BADGE_VARIANT[overlay.itemStatus]}>
						item {statusLabel(overlay.itemStatus)}
					</Badge>
					<span className="text-ink-muted font-mono text-[11px]">{overlay.candidate.model}</span>
					<HashChip candidate={overlay.candidate} hash={overlay.candidateConfigHash} />
				</div>
			</Block>

			{/* Live score */}
			{(overlay.score !== null || overlay.verdict !== null) && (
				<Block label="Score">
					<div className="flex items-center gap-1.5">
						<span className="text-ink text-sm font-medium tabular-nums">
							{formatScore(overlay.score)}
						</span>
						{overlay.verdict && (
							<Badge
								variant={
									overlay.verdict === "pass"
										? "default"
										: overlay.verdict === "warn"
											? "warning"
											: "danger"
								}
							>
								{overlay.verdict}
							</Badge>
						)}
					</div>
					{overlay.dimensionScores && (
						<div className="mt-1 flex flex-wrap gap-1">
							{Object.entries(overlay.dimensionScores).map(([dimension, score]) => (
								<span
									className="bg-surface text-ink-muted rounded-pill px-1.5 py-px text-[10px] tabular-nums"
									key={dimension}
								>
									{dimension} {formatScore(score)}
								</span>
							))}
						</div>
					)}
				</Block>
			)}

			{overlay.criticalFailures.length > 0 && (
				<p className="text-danger m-0 text-xs">Critical: {overlay.criticalFailures.join(", ")}</p>
			)}

			{/* Token / cost counters + latency */}
			<Block label="Usage">
				<div className="text-ink-muted flex flex-col gap-0.5 text-[11px] tabular-nums">
					<span>
						tokens {formatTokens(overlay.usage?.totalTokens ?? null)} · cost{" "}
						{formatCostMicros(overlay.usage?.costMicros ?? null)}
					</span>
					{overlay.usage && (
						<span className="text-ink-subtle">
							in {formatTokens(overlay.usage.inputTokens)} · out{" "}
							{formatTokens(overlay.usage.outputTokens)} · cache{" "}
							{formatTokens(overlay.usage.cachedTokens)} · reas{" "}
							{formatTokens(overlay.usage.reasoningTokens)}
						</span>
					)}
					<span className="text-ink-subtle">
						runtime {formatDurationMs(overlay.runtimeMs)} · TTFT{" "}
						{formatDurationMs(overlay.timeToFirstTokenMs)} · reasoning{" "}
						{formatDurationMs(overlay.reasoningDurationMs)}
					</span>
				</div>
			</Block>

			{/* Per-model-call usage */}
			{overlay.modelCalls.length > 0 && (
				<Block label="Model calls">
					<div className="max-h-36 overflow-y-auto">
						<div className="text-ink-subtle grid grid-cols-[18px_minmax(0,1fr)_repeat(3,44px)] gap-x-1 text-[10px] uppercase">
							<span>#</span>
							<span>model</span>
							<span className="text-right">in</span>
							<span className="text-right">out</span>
							<span className="text-right">cost</span>
						</div>
						{overlay.modelCalls.map((call) => (
							<div
								className="text-ink-muted grid grid-cols-[18px_minmax(0,1fr)_repeat(3,44px)] gap-x-1 font-mono text-[10px] tabular-nums"
								key={call.index}
								title={`${call.provider}/${call.model} · cached ${call.cachedTokens ?? "—"} · reasoning ${call.reasoningTokens ?? "—"}`}
							>
								<span>{call.index}</span>
								<span className="truncate">{call.model}</span>
								<span className="text-right">{formatTokens(call.inputTokens)}</span>
								<span className="text-right">{formatTokens(call.outputTokens)}</span>
								<span className="text-right">{formatCostMicros(call.costMicros)}</span>
							</div>
						))}
					</div>
				</Block>
			)}

			{/* Per-message token estimates */}
			{overlay.perMessageTokenEstimates.length > 0 && (
				<Block label="Per-message tokens (est.)">
					<div className="max-h-28 overflow-y-auto">
						{overlay.perMessageTokenEstimates.map((estimate) => (
							<div
								className="text-ink-muted flex justify-between gap-2 font-mono text-[10px] tabular-nums"
								key={estimate.messageId}
								title={estimate.messageId}
							>
								<span className="truncate">
									{estimate.role} · {estimate.messageId.slice(0, 8)}…
								</span>
								<span>{formatTokens(estimate.estimatedTokens)} est.</span>
							</div>
						))}
					</div>
				</Block>
			)}

			{/* Tool calls grouped by tool */}
			<Block label="Tool calls">
				{overlay.toolCalls.length === 0 ? (
					<p className="text-ink-subtle m-0 text-xs">None yet.</p>
				) : (
					<div className="flex flex-col gap-0.5">
						{overlay.toolCalls.map((tool) => (
							<div
								className="text-ink-muted flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums"
								key={tool.toolName}
							>
								<span className="truncate">{tool.toolName}</span>
								<span className="shrink-0">
									{tool.calls}×
									<span className={tool.failures > 0 ? "text-danger" : "text-ink-subtle"}>
										{" "}
										· {tool.failures} failed
									</span>
									<span className="text-ink-subtle">
										{" "}
										· p50 {formatDurationMs(tool.p50LatencyMs)}
									</span>
								</span>
							</div>
						))}
					</div>
				)}
			</Block>

			{/* Failed calls & retry loops */}
			<Block label="Failed calls & retry loops">
				{failedTools.length === 0 ? (
					<p className="text-ink-subtle m-0 text-xs">None.</p>
				) : (
					<div className="flex flex-col gap-0.5">
						{failedTools.map((tool) => (
							<div
								className="flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums"
								key={tool.toolName}
							>
								<span className="text-ink-muted truncate">{tool.toolName}</span>
								<span className="flex shrink-0 items-center gap-1">
									{tool.failures > 0 && <span className="text-danger">{tool.failures} failed</span>}
									{tool.duplicates > 0 && (
										<span className="text-warning">{tool.duplicates} dup</span>
									)}
									{hasSuspiciousLoop(tool.duplicates) && (
										<span
											className="bg-warning-soft text-warning inline-flex items-center gap-0.5 rounded-pill px-1.5 py-px text-[10px]"
											title="More than two duplicate calls — suspicious loop"
										>
											<Repeat2 size={10} />
											loop?
										</span>
									)}
								</span>
							</div>
						))}
					</div>
				)}
			</Block>

			{/* Budgets */}
			<Block label="Budgets">
				<BudgetRows budgets={overlay.budgets} />
			</Block>

			{/* Deterministic checks */}
			<Block label="Deterministic checks">
				{overlay.checks.length === 0 ? (
					<p className="text-ink-subtle m-0 text-xs">None recorded.</p>
				) : (
					<div className="flex flex-col gap-1">
						{overlay.checks.map((check) => (
							<div className="flex items-start gap-1.5 text-xs" key={check.id}>
								{check.passed === null ? (
									<CircleDashed className="text-ink-subtle mt-px shrink-0" size={12} />
								) : check.passed ? (
									<CheckCircle2 className="text-ink-subtle mt-px shrink-0" size={12} />
								) : (
									<XCircle className="text-danger mt-px shrink-0" size={12} />
								)}
								<span
									className={cn("min-w-0", check.passed === false ? "text-ink" : "text-ink-muted")}
								>
									{check.description}
									<span className="text-ink-subtle"> · {check.dimension}</span>
									{check.severity === "critical" && (
										<span className="bg-danger-soft text-danger ml-1 rounded-pill px-1.5 py-px text-[10px]">
											critical
										</span>
									)}
								</span>
							</div>
						))}
					</div>
				)}
			</Block>

			{/* Judge result */}
			{overlay.judge && (
				<Block label="Judge">
					<div className="flex flex-col gap-1">
						<p className="text-ink-subtle m-0 font-mono text-[10px]">
							{overlay.judge.model} · {overlay.judge.promptVersion} · confidence{" "}
							{formatPercent(overlay.judge.confidence)}
						</p>
						<p className="text-ink-muted m-0 text-xs">{overlay.judge.rationale}</p>
						{Object.keys(overlay.judge.scores).length > 0 && (
							<div className="flex flex-wrap gap-1">
								{Object.entries(overlay.judge.scores).map(([component, score]) => (
									<span
										className="bg-surface text-ink-muted rounded-pill px-1.5 py-px text-[10px] tabular-nums"
										key={component}
									>
										{component} {formatScore(score)}
									</span>
								))}
							</div>
						)}
					</div>
				</Block>
			)}

			{/* Links */}
			<div className="flex items-center gap-3 border-t border-(--line) pt-2">
				<Link
					className="text-ink-muted inline-flex items-center gap-1 text-xs no-underline hover:text-ink"
					href={`/observability/runs/${overlay.runId}`}
				>
					Run detail <ExternalLink size={11} />
				</Link>
				<Link
					className="text-ink-muted inline-flex items-center gap-1 text-xs no-underline hover:text-ink"
					href={`/inspector?session=${sessionId}`}
				>
					Raw events <ExternalLink size={11} />
				</Link>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Public component — mounted in the session detail panel (spec §6 overlay).
// Renders nothing for ordinary users or non-eval sessions; never touches the
// transcript.
// ---------------------------------------------------------------------------

export function EvalSessionSection({ sessionId }: { sessionId: string }) {
	const api = useApi();
	const { isInternal } = useInternalAccount();

	const { data } = useQuery({
		enabled: isInternal,
		// 404 (not an eval session / not internal) resolves to null — silence.
		queryFn: () => api.getEvalSessionOverlay(sessionId),
		queryKey: ["eval-overlay", sessionId],
		refetchInterval: (query) => {
			const overlay = query.state.data;
			return overlay && isItemActive(overlay.itemStatus) ? OVERLAY_REFETCH_MS : false;
		},
		staleTime: OVERLAY_REFETCH_MS,
	});

	if (!isInternal || !data) return null;

	return (
		<div>
			<p className="text-ink-subtle m-0 mb-0.5 text-[11px] uppercase tracking-wide">Eval</p>
			<OverlayBody overlay={data} sessionId={sessionId} />
		</div>
	);
}
