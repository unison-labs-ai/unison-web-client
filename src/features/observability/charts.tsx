// Tiny dependency-free SVG chart primitives for the run detail page
// (spec §6/§10). These trade axis furniture for honesty: every chart labels
// its max and renders nothing misleading when data is missing.

import { formatDelta, formatScore } from "@/lib/format";
import { cn } from "@/ui/utils";

export function ChartEmpty({ label }: { label: string }) {
	return <p className="text-ink-subtle m-0 py-4 text-center text-xs">{label}</p>;
}

// ---------------------------------------------------------------------------
// Score bars (scorecards by category/dimension)
// ---------------------------------------------------------------------------

export type ScoreBarItem = { delta?: number | null; label: string; value: number };

/** Horizontal score bars. Detects the 0–1 vs 0–100 scale from the data. */
export function ScoreBarList({ emptyLabel, items }: { emptyLabel: string; items: ScoreBarItem[] }) {
	if (items.length === 0) return <ChartEmpty label={emptyLabel} />;
	const scaleMax = items.some((item) => Math.abs(item.value) > 1.5) ? 100 : 1;
	return (
		<div className="flex flex-col gap-2">
			{items.map((item) => {
				const fraction = Math.min(1, Math.max(0, item.value / scaleMax));
				return (
					<div className="flex items-center gap-2" key={item.label}>
						<span className="text-ink-muted w-24 shrink-0 truncate text-xs" title={item.label}>
							{item.label}
						</span>
						<svg
							className="h-2 min-w-0 flex-1"
							preserveAspectRatio="none"
							role="img"
							viewBox="0 0 100 8"
						>
							<title>{`${item.label}: ${formatScore(item.value)}`}</title>
							<rect fill="var(--surface)" height="8" rx="2" width="100" x="0" y="0" />
							<rect
								fill="var(--ink-subtle)"
								height="8"
								rx="2"
								width={Math.max(fraction * 100, fraction > 0 ? 1 : 0)}
								x="0"
								y="0"
							/>
						</svg>
						<span className="text-ink w-10 shrink-0 text-right text-xs tabular-nums">
							{formatScore(item.value)}
						</span>
						{item.delta !== undefined && (
							<span
								className={cn(
									"w-12 shrink-0 text-right text-[11px] tabular-nums",
									item.delta === null || item.delta === 0
										? "text-ink-subtle"
										: item.delta > 0
											? "text-ink-muted"
											: "text-danger",
								)}
							>
								{formatDelta(item.delta)}
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Line / bar series (cost + tokens over time)
// ---------------------------------------------------------------------------

export type SeriesPoint = { label: string; value: number };

const SERIES_WIDTH = 280;
const SERIES_HEIGHT = 80;
const SERIES_PAD = 4;

export function MiniLineChart({
	emptyLabel,
	formatValue,
	points,
	title,
}: {
	emptyLabel: string;
	formatValue: (value: number) => string;
	points: SeriesPoint[];
	title: string;
}) {
	if (points.length === 0) return <ChartEmpty label={emptyLabel} />;
	const max = Math.max(...points.map((point) => point.value), 1);
	const stepX = points.length > 1 ? (SERIES_WIDTH - SERIES_PAD * 2) / (points.length - 1) : 0;
	const coords = points.map((point, index) => ({
		x: SERIES_PAD + index * stepX,
		y: SERIES_HEIGHT - SERIES_PAD - (point.value / max) * (SERIES_HEIGHT - SERIES_PAD * 2),
	}));
	const polyline = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");
	const last = points[points.length - 1];
	return (
		<div className="flex flex-col gap-1">
			<svg
				className="w-full"
				preserveAspectRatio="none"
				role="img"
				viewBox={`0 0 ${SERIES_WIDTH} ${SERIES_HEIGHT}`}
			>
				<title>{title}</title>
				<line
					stroke="var(--line)"
					strokeWidth="1"
					x1="0"
					x2={SERIES_WIDTH}
					y1={SERIES_HEIGHT - SERIES_PAD}
					y2={SERIES_HEIGHT - SERIES_PAD}
				/>
				<polyline
					fill="none"
					points={polyline}
					stroke="var(--ink-subtle)"
					strokeWidth="1.5"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			<div className="text-ink-subtle flex justify-between text-[10px] tabular-nums">
				<span>{points.length} items</span>
				<span>
					latest {last ? formatValue(last.value) : "—"} · max {formatValue(max)}
				</span>
			</div>
		</div>
	);
}

export function MiniBarChart({
	emptyLabel,
	formatValue,
	points,
	title,
}: {
	emptyLabel: string;
	formatValue: (value: number) => string;
	points: SeriesPoint[];
	title: string;
}) {
	if (points.length === 0) return <ChartEmpty label={emptyLabel} />;
	const max = Math.max(...points.map((point) => point.value), 1);
	const innerWidth = SERIES_WIDTH - SERIES_PAD * 2;
	const slot = innerWidth / points.length;
	const barWidth = Math.max(1, slot * 0.7);
	// Labels can repeat (one case, several trials) — disambiguate by occurrence
	// so keys stay stable for this append-only series.
	const seen = new Map<string, number>();
	const bars = points.map((point) => {
		const occurrence = (seen.get(point.label) ?? 0) + 1;
		seen.set(point.label, occurrence);
		return { ...point, key: `${point.label}#${occurrence}` };
	});
	return (
		<div className="flex flex-col gap-1">
			<svg
				className="w-full"
				preserveAspectRatio="none"
				role="img"
				viewBox={`0 0 ${SERIES_WIDTH} ${SERIES_HEIGHT}`}
			>
				<title>{title}</title>
				{bars.map((bar, index) => {
					const height = (bar.value / max) * (SERIES_HEIGHT - SERIES_PAD * 2);
					return (
						<rect
							fill="var(--ink-subtle)"
							height={Math.max(height, bar.value > 0 ? 1 : 0)}
							key={bar.key}
							rx="1"
							width={barWidth}
							x={SERIES_PAD + index * slot + (slot - barWidth) / 2}
							y={SERIES_HEIGHT - SERIES_PAD - Math.max(height, bar.value > 0 ? 1 : 0)}
						/>
					);
				})}
			</svg>
			<div className="text-ink-subtle flex justify-between text-[10px] tabular-nums">
				<span>{points.length} items</span>
				<span>max {formatValue(max)}</span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Stacked horizontal bar (tool-call waterfall)
// ---------------------------------------------------------------------------

export type StackedSegment = { color: string; label: string; value: number };

/** One horizontal stacked bar scaled against `max` (shared across rows). */
export function StackedBar({
	max,
	segments,
	title,
}: {
	max: number;
	segments: StackedSegment[];
	title: string;
}) {
	const safeMax = Math.max(max, 1);
	let cursor = 0;
	return (
		<svg className="h-3 w-full" preserveAspectRatio="none" role="img" viewBox="0 0 100 12">
			<title>{title}</title>
			<rect fill="var(--surface)" height="12" rx="2" width="100" x="0" y="0" />
			{segments.map((segment) => {
				const width = (segment.value / safeMax) * 100;
				const x = cursor;
				cursor += width;
				if (segment.value <= 0) return null;
				return (
					<rect
						fill={segment.color}
						height="12"
						key={segment.label}
						width={Math.max(width, 0.5)}
						x={x}
						y="0"
					/>
				);
			})}
		</svg>
	);
}
