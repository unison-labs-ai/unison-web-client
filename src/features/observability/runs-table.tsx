"use client";

import type { EvalRunWire } from "@unison/contracts";
import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatCostMicros, formatDurationMs, formatScore, formatTokens } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { cn } from "@/ui/utils";
import { AnimatedSummary, AnimatedSummaryStyles, CategoryChips, Delta, HashChip } from "./display";
import {
	isRunActive,
	isRunCancellable,
	RUN_STATUS_BADGE_VARIANT,
	statusLabel,
} from "./eval-status";

function runDuration(run: EvalRunWire, now: number): string {
	if (!run.startedAt) return "—";
	const started = Date.parse(run.startedAt);
	if (isRunActive(run.status)) {
		return formatDurationMs(now - started);
	}
	if (run.completedAt) {
		return formatDurationMs(Date.parse(run.completedAt) - started);
	}
	return "—";
}

type RunsTableProps = {
	cancelPendingId: string | null;
	now: number;
	onCancel: (runId: string) => void;
	runs: EvalRunWire[];
};

/** The 11-column main table of /observability (spec §6). Rows navigate to the
 * run detail page; cancel stays inline for queued/running runs. */
export function RunsTable({ cancelPendingId, now, onCancel, runs }: RunsTableProps) {
	const router = useRouter();

	return (
		<>
			<AnimatedSummaryStyles />
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead>Run</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Suite</TableHead>
						<TableHead>Candidate</TableHead>
						<TableHead>Score</TableHead>
						<TableHead>Cost</TableHead>
						<TableHead>Tokens</TableHead>
						<TableHead>Tools</TableHead>
						<TableHead>Runtime</TableHead>
						<TableHead>Categories</TableHead>
						<TableHead>Started by</TableHead>
						<TableHead aria-label="Actions" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{runs.map((run) => {
						const active = isRunActive(run.status);
						const usage = run.summary?.usage ?? null;
						return (
							<TableRow
								className="transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
								key={run.id}
								onClick={() => router.push(`/observability/runs/${run.id}`)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										router.push(`/observability/runs/${run.id}`);
									}
								}}
								tabIndex={0}
							>
								<TableCell className="max-w-72">
									<span className="flex min-w-0 flex-col">
										{active && run.latestSummary ? (
											<AnimatedSummary text={run.latestSummary} />
										) : (
											<span className="text-ink truncate font-medium" title={run.title}>
												{run.title}
											</span>
										)}
										<span className="text-ink-subtle text-[11px] tabular-nums">
											{run.itemCounts.completed}/{run.itemCounts.total} items
											{run.itemCounts.failed > 0 && (
												<span className="text-danger"> · {run.itemCounts.failed} failed</span>
											)}
										</span>
									</span>
								</TableCell>
								<TableCell>
									<Badge variant={RUN_STATUS_BADGE_VARIANT[run.status]}>
										{statusLabel(run.status)}
									</Badge>
								</TableCell>
								<TableCell>{run.suiteId}</TableCell>
								<TableCell>
									<span className="flex items-center gap-1.5">
										<span
											className="max-w-36 truncate font-mono text-xs"
											title={run.candidate.model}
										>
											{run.candidate.model}
										</span>
										<HashChip candidate={run.candidate} hash={run.candidateConfigHash} />
									</span>
								</TableCell>
								<TableCell className="tabular-nums">
									<span className="flex items-center gap-1">
										{formatScore(run.summary?.aggregateScore)}
										<Delta value={run.summary?.baseline?.aggregateDelta ?? null} />
									</span>
								</TableCell>
								<TableCell className="tabular-nums">
									{formatCostMicros(usage?.costMicros ?? null)}
								</TableCell>
								<TableCell className="tabular-nums">
									{formatTokens(usage?.totalTokens ?? null)}
								</TableCell>
								<TableCell className="tabular-nums">
									{usage ? (
										<span>
											{usage.toolCalls}
											<span
												className={cn(
													usage.failedToolCalls > 0 ? "text-danger" : "text-ink-subtle",
												)}
											>
												{" "}
												· {usage.failedToolCalls} failed
											</span>
										</span>
									) : (
										"—"
									)}
								</TableCell>
								<TableCell className="whitespace-nowrap tabular-nums">
									{runDuration(run, now)}
								</TableCell>
								<TableCell className="max-w-56">
									{run.summary ? <CategoryChips scores={run.summary.categoryScores} /> : "—"}
								</TableCell>
								<TableCell className="max-w-40 truncate">
									{run.startedByScheduler ? "scheduler" : (run.startedByEmail ?? "—")}
								</TableCell>
								<TableCell className="w-px">
									{isRunCancellable(run.status) && (
										<Button
											disabled={cancelPendingId === run.id}
											onClick={(event) => {
												event.stopPropagation();
												onCancel(run.id);
											}}
											size="sm"
											variant="ghost"
										>
											<Ban size={12} />
											{cancelPendingId === run.id ? "Cancelling…" : "Cancel"}
										</Button>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</>
	);
}
