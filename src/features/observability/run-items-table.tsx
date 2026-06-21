"use client";

import type { EvalRunItemWire } from "@unison/contracts";
import { Repeat2 } from "lucide-react";
import Link from "next/link";

import { formatCostMicros, formatDurationMs, formatScore, formatTokens } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { AnimatedSummary } from "./display";
import { hasSuspiciousLoop } from "./eval-metrics";
import { ITEM_STATUS_BADGE_VARIANT, isItemActive, statusLabel } from "./eval-status";

function itemRuntime(item: EvalRunItemWire, now: number): string {
	if (item.runtimeMs !== null) return formatDurationMs(item.runtimeMs);
	if (isItemActive(item.status) && item.startedAt) {
		return formatDurationMs(now - Date.parse(item.startedAt));
	}
	if (item.startedAt && item.completedAt) {
		return formatDurationMs(Date.parse(item.completedAt) - Date.parse(item.startedAt));
	}
	return "—";
}

/** The nine-column run-item table (spec §6). Session links use the item's
 * threadId — /sessions/:id resolves thread ids, not agent-run session ids. */
export function RunItemsTable({ items, now }: { items: EvalRunItemWire[]; now: number }) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead>Case</TableHead>
					<TableHead>Session</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Score</TableHead>
					<TableHead>Tokens</TableHead>
					<TableHead>Cost</TableHead>
					<TableHead>Tools</TableHead>
					<TableHead>Runtime</TableHead>
					<TableHead>Latest summary</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((item) => {
					const usage = item.usage;
					const dimensionEntries = Object.entries(item.dimensionScores ?? {});
					return (
						<TableRow key={item.id}>
							<TableCell className="max-w-56">
								<span className="flex min-w-0 flex-col">
									<span className="text-ink truncate text-xs font-medium" title={item.caseTitle}>
										{item.caseTitle}
									</span>
									<span className="text-ink-subtle font-mono text-[11px]">
										{item.caseId} · {item.category}
										{item.trial > 1 && ` · trial ${item.trial}`}
									</span>
								</span>
							</TableCell>
							<TableCell>
								{item.threadId ? (
									<Link
										className="text-ink-muted font-mono text-xs no-underline hover:text-ink"
										href={`/sessions/${item.threadId}`}
										title={item.threadId}
									>
										{item.threadId.slice(0, 8)}…
									</Link>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell>
								<Badge variant={ITEM_STATUS_BADGE_VARIANT[item.status]}>
									{statusLabel(item.status)}
								</Badge>
							</TableCell>
							<TableCell className="tabular-nums">
								{dimensionEntries.length > 0 ? (
									<TooltipProvider delayDuration={150}>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="cursor-help underline decoration-dotted underline-offset-2">
													{formatScore(item.score)}
												</span>
											</TooltipTrigger>
											<TooltipContent>
												<div className="flex flex-col gap-0.5 tabular-nums">
													{dimensionEntries.map(([dimension, score]) => (
														<span key={dimension}>
															{dimension}: {formatScore(score)}
														</span>
													))}
												</div>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								) : (
									formatScore(item.score)
								)}
								{item.verdict && (
									<Badge
										className="ml-1.5"
										variant={
											item.verdict === "pass"
												? "default"
												: item.verdict === "warn"
													? "warning"
													: "danger"
										}
									>
										{item.verdict}
									</Badge>
								)}
							</TableCell>
							<TableCell className="whitespace-nowrap tabular-nums">
								{usage ? (
									<span
										title={`in ${formatTokens(usage.inputTokens)} · out ${formatTokens(usage.outputTokens)} · cache ${formatTokens(usage.cachedTokens)} · reas ${formatTokens(usage.reasoningTokens)}`}
									>
										{formatTokens(usage.totalTokens)}
									</span>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="tabular-nums">
								{formatCostMicros(usage?.costMicros ?? null)}
							</TableCell>
							<TableCell className="whitespace-nowrap tabular-nums">
								{usage ? (
									<span className="inline-flex items-center gap-1">
										{usage.toolCalls}
										<span className={usage.failedToolCalls > 0 ? "text-danger" : "text-ink-subtle"}>
											· {usage.failedToolCalls} failed
										</span>
										<span className="text-ink-subtle">· {usage.duplicateToolCalls} dup</span>
										{hasSuspiciousLoop(usage.duplicateToolCalls) && (
											<span
												className="bg-warning-soft text-warning inline-flex items-center gap-0.5 rounded-pill px-1.5 py-px text-[10px]"
												title="More than two duplicate tool calls — suspicious loop"
											>
												<Repeat2 size={10} />
												loop?
											</span>
										)}
									</span>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="whitespace-nowrap tabular-nums">
								{itemRuntime(item, now)}
							</TableCell>
							<TableCell className="max-w-64">
								{item.latestSummary ? (
									isItemActive(item.status) ? (
										<AnimatedSummary text={item.latestSummary} />
									) : (
										<span className="text-ink-muted block truncate" title={item.latestSummary}>
											{item.latestSummary}
										</span>
									)
								) : (
									"—"
								)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
