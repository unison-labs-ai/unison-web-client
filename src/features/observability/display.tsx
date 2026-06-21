// Small shared display bits for the observability screens: status badges,
// candidate hash chips, signed deltas, category chips and the animated
// "latest summary" line the spec wants while a run is active.

import type { EvalCandidateWire } from "@unison/contracts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { formatDelta, formatScore } from "@/lib/format";
import { GroupCard, PageSection } from "@/ui/page-blocks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { cn } from "@/ui/utils";

// ---------------------------------------------------------------------------
// Animated latest-summary line (spec §6: the run title animates through the
// latest reasoning summaries while active, then settles on the title).
// ---------------------------------------------------------------------------

const SUMMARY_FADE_CSS = `
@keyframes eval-summary-fade {
	from { opacity: 0.25; }
	to { opacity: 1; }
}
.eval-summary-fade {
	animation: eval-summary-fade 0.7s ease-out;
}
`;

/** Render once per screen that uses AnimatedSummary. */
export function AnimatedSummaryStyles() {
	return <style>{SUMMARY_FADE_CSS}</style>;
}

/** Keyed remount fades each new summary in — a subtle pulse on change. */
export function AnimatedSummary({ text }: { text: string }) {
	return (
		<span className="eval-summary-fade text-ink-muted truncate italic" key={text} title={text}>
			{text}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Candidate config-hash chip
// ---------------------------------------------------------------------------

export function HashChip({ candidate, hash }: { candidate?: EvalCandidateWire; hash: string }) {
	const short = hash.length > 8 ? hash.slice(0, 8) : hash;
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="bg-surface text-ink-subtle rounded-pill border border-(--border) px-1.5 py-px font-mono text-[10px]">
						{short}
					</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-72">
					<div className="flex flex-col gap-0.5 font-mono text-[11px]">
						<span className="break-all">{hash}</span>
						{candidate && (
							<>
								<span>
									{candidate.provider} / {candidate.model}
								</span>
								<span>budget: {candidate.budgetProfile}</span>
								{candidate.judgeModel && <span>judge: {candidate.judgeModel}</span>}
							</>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ---------------------------------------------------------------------------
// Signed delta with direction arrow
// ---------------------------------------------------------------------------

export function Delta({
	format = formatScore,
	/** Set when up is bad (cost): inverts the good/bad direction. */
	invert = false,
	value,
}: {
	format?: (value: number) => string;
	invert?: boolean;
	value: number | null | undefined;
}) {
	if (value === null || value === undefined) return null;
	const up = value > 0;
	const flat = value === 0;
	const good = flat ? null : invert ? !up : up;
	// Only regressions get color — improvements stay neutral ink.
	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 text-[11px] tabular-nums",
				good === false ? "text-danger" : good ? "text-ink-muted" : "text-ink-subtle",
			)}
			title="vs baseline"
		>
			{!flat && (up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
			{formatDelta(value, format)}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Compact per-category score chips
// ---------------------------------------------------------------------------

export function CategoryChips({ scores }: { scores: Record<string, number> }) {
	const entries = Object.entries(scores);
	if (entries.length === 0) return <span className="text-ink-subtle">—</span>;
	return (
		<span className="flex flex-wrap gap-1">
			{entries.map(([category, score]) => (
				<span
					className="bg-surface text-ink-muted rounded-pill px-1.5 py-px text-[10px] tabular-nums"
					key={category}
					title={`${category}: ${formatScore(score)}`}
				>
					{category} {formatScore(score)}
				</span>
			))}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Detail sections — PageSection header + GroupCard body, the shared card
// recipe (settings, automations). Pass rows directly for hairline separation,
// or wrap free-form content (charts, grids) in SectionBody.
// ---------------------------------------------------------------------------

export function DetailSection({ children, title }: { children: ReactNode; title: string }) {
	return (
		<PageSection title={title}>
			<GroupCard>{children}</GroupCard>
		</PageSection>
	);
}

export function SectionBody({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("px-4 py-3", className)}>{children}</div>;
}
