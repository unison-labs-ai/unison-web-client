"use client";

// Floating usage meter for the character-budgeted memory documents (the profile).
// A thin progress bar + "5,800 / 6,000" with a tooltip explaining the limit; it
// turns danger when over budget (the autosave guard blocks the save until trimmed).
// Colors use CSS vars directly so the danger state renders regardless of the
// Tailwind token set.
export function CharBudgetMeter({ count, max }: { count: number; max: number }) {
	const pct = Math.min(100, Math.round((count / Math.max(max, 1)) * 100));
	const over = count > max;

	return (
		<span
			className="flex items-center gap-1.5 text-xs text-ink-subtle"
			title={`This is your profile — the assistant reads it at the start of every session. It's limited to ${max.toLocaleString()} characters so it stays focused; the assistant trims it automatically as you chat.`}
		>
			<span
				aria-hidden
				className="block h-1.5 w-14 overflow-hidden rounded-full"
				style={{ backgroundColor: "var(--border)" }}
			>
				<span
					className="block h-full rounded-full"
					style={{
						backgroundColor: over ? "var(--danger)" : "var(--ink-subtle)",
						width: `${pct}%`,
					}}
				/>
			</span>
			<span style={over ? { color: "var(--danger)" } : undefined}>
				{count.toLocaleString()} / {max.toLocaleString()}
			</span>
		</span>
	);
}
