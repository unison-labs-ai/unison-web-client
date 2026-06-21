// Numeric formatters for the observability dashboard (docs/evals/architecture/
// runtime-and-dashboard.md §6): costs arrive as integer micro-USD, tokens as raw
// counts, durations as milliseconds. Missing data renders as an em-dash so the
// dashboard never fabricates a number.

const EM_DASH = "—";

function trimTrailingZero(value: string): string {
	return value.replace(/\.0$/, "");
}

/** Integer micro-USD → "$0.0123" (sub-dollar keeps 4 decimals, dollars keep 2). */
export function formatCostMicros(micros: number | null | undefined): string {
	if (micros === null || micros === undefined || Number.isNaN(micros)) return EM_DASH;
	const dollars = micros / 1_000_000;
	const abs = Math.abs(dollars);
	const sign = dollars < 0 ? "-" : "";
	if (abs === 0) return "$0.00";
	if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
	return `${sign}$${abs.toFixed(4)}`;
}

/** Raw token count → "843", "1.2k", "3.4M". */
export function formatTokens(count: number | null | undefined): string {
	if (count === null || count === undefined || Number.isNaN(count)) return EM_DASH;
	const abs = Math.abs(count);
	const sign = count < 0 ? "-" : "";
	if (abs < 1000) return `${sign}${abs}`;
	if (abs < 1_000_000) return `${sign}${trimTrailingZero((abs / 1000).toFixed(1))}k`;
	if (abs < 1_000_000_000) return `${sign}${trimTrailingZero((abs / 1_000_000).toFixed(1))}M`;
	return `${sign}${trimTrailingZero((abs / 1_000_000_000).toFixed(1))}B`;
}

/** Milliseconds → "850ms", "12.3s", "4m 05s", "1h 12m". */
export function formatDurationMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || Number.isNaN(ms)) return EM_DASH;
	const abs = Math.max(0, ms);
	if (abs < 1000) return `${Math.round(abs)}ms`;
	if (abs < 60_000) return `${trimTrailingZero((abs / 1000).toFixed(1))}s`;
	const totalMinutes = Math.floor(abs / 60_000);
	if (totalMinutes < 60) {
		const seconds = Math.floor((abs % 60_000) / 1000);
		return `${totalMinutes}m ${String(seconds).padStart(2, "0")}s`;
	}
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Eval scores can arrive on a 0–1 or 0–100 scale; format for either. */
export function formatScore(score: number | null | undefined): string {
	if (score === null || score === undefined || Number.isNaN(score)) return EM_DASH;
	return Math.abs(score) > 1.5 ? score.toFixed(0) : score.toFixed(2);
}

/** Fraction (0–1) or percentage (0–100) → "82%". */
export function formatPercent(value: number | null | undefined): string {
	if (value === null || value === undefined || Number.isNaN(value)) return EM_DASH;
	const percent = Math.abs(value) <= 1 ? value * 100 : value;
	return `${trimTrailingZero(percent.toFixed(1))}%`;
}

/** Signed delta — "+0.04" / "-$0.0123" / "±0.00" — with a pluggable formatter. */
export function formatDelta(
	value: number | null | undefined,
	format: (value: number) => string = formatScore,
): string {
	if (value === null || value === undefined || Number.isNaN(value)) return EM_DASH;
	if (value === 0) return `±${format(0)}`;
	return value > 0 ? `+${format(value)}` : `-${format(Math.abs(value))}`;
}
