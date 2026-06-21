// The eight top cards of /observability (spec §6, implemented 1:1). Values are
// computed from the currently listed runs; anything underivable renders "—".

import type { ReactNode } from "react";

import {
	formatCostMicros,
	formatDelta,
	formatDurationMs,
	formatPercent,
	formatScore,
	formatTokens,
} from "@/lib/format";
import { cn } from "@/ui/utils";
import type { RunCards } from "./eval-metrics";

function Card({
	label,
	sublabel,
	value,
	valueClassName,
}: {
	label: string;
	sublabel: ReactNode;
	value: ReactNode;
	valueClassName?: string;
}) {
	return (
		<div className="bg-surface-muted flex flex-col gap-1 rounded-lg border border-(--border) p-3">
			<span className="text-ink-subtle text-xs">{label}</span>
			<span className={cn("text-ink text-lg font-medium tabular-nums", valueClassName)}>
				{value}
			</span>
			<span className="text-ink-subtle text-[11px] leading-4 tabular-nums">{sublabel}</span>
		</div>
	);
}

function deltaSublabel(delta: string, hasDelta: boolean): string {
	return hasDelta ? `${delta} vs baseline (latest run)` : "no baseline on listed runs";
}

export function RunCardsGrid({ cards }: { cards: RunCards }) {
	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<Card
				label="Runs in progress"
				sublabel={`${cards.activeItems} active items`}
				value={cards.activeRuns}
			/>
			<Card
				label="Average score"
				sublabel={deltaSublabel(
					formatDelta(cards.scoreBaselineDelta),
					cards.scoreBaselineDelta !== null,
				)}
				value={formatScore(cards.averageScore)}
			/>
			<Card
				label="Pass rate"
				sublabel="cases above threshold"
				value={formatPercent(cards.passRate)}
			/>
			<Card
				label="Critical failures"
				sublabel="safety / silent exhaustion / orphans"
				value={cards.criticalFailures}
				valueClassName={cards.criticalFailures > 0 ? "text-danger" : undefined}
			/>
			<Card
				label="Total cost"
				sublabel={deltaSublabel(
					formatDelta(cards.costBaselineDeltaMicros, formatCostMicros),
					cards.costBaselineDeltaMicros !== null,
				)}
				value={formatCostMicros(cards.totalCostMicros)}
			/>
			<Card
				label="Tokens"
				sublabel={
					cards.tokens
						? `in ${formatTokens(cards.tokens.input)} · out ${formatTokens(cards.tokens.output)} · cache ${formatTokens(cards.tokens.cached)} · reas ${formatTokens(cards.tokens.reasoning)} · preflight ${formatTokens(cards.tokens.estimatedInput)} (est.)`
						: "no usage reported yet"
				}
				value={formatTokens(cards.tokens?.total ?? null)}
			/>
			<Card
				label="Tool calls"
				sublabel={
					cards.tools
						? `${cards.tools.failed} failed · ${cards.tools.duplicate} duplicate`
						: "no usage reported yet"
				}
				value={cards.tools ? cards.tools.total : "—"}
			/>
			<Card
				label="Runtime"
				sublabel={`p95 ${formatDurationMs(cards.runtimeP95Ms)} · longest active ${formatDurationMs(cards.longestActiveMs)}`}
				value={`p50 ${formatDurationMs(cards.runtimeP50Ms)}`}
			/>
		</div>
	);
}
