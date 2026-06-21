import type { EvalRunItemStatusWire, EvalRunStatusWire } from "@unison/contracts";

// Status → Badge variant mapping. Design rule: status stays neutral ink —
// only failures get danger and degraded outcomes get warning. No green or
// sky status chips in app chrome.

export type EvalBadgeVariant = "danger" | "default" | "warning";

export const RUN_STATUS_BADGE_VARIANT: Record<EvalRunStatusWire, EvalBadgeVariant> = {
	cancelled: "default",
	completed: "default",
	failed: "danger",
	grading: "default",
	queued: "default",
	running: "default",
};

export const ITEM_STATUS_BADGE_VARIANT: Record<EvalRunItemStatusWire, EvalBadgeVariant> = {
	budget_exhausted: "warning",
	cancelled: "default",
	completed: "default",
	failed: "danger",
	grading: "default",
	queued: "default",
	running: "default",
	seeding: "default",
	skipped: "default",
	timed_out: "warning",
};

export function isRunActive(status: EvalRunStatusWire): boolean {
	return status === "queued" || status === "running" || status === "grading";
}

/** Cancel applies to queued/running only (pause is deliberately unimplemented —
 * the spec's API surface defines cancel only). */
export function isRunCancellable(status: EvalRunStatusWire): boolean {
	return status === "queued" || status === "running";
}

export function isItemActive(status: EvalRunItemStatusWire): boolean {
	return (
		status === "queued" || status === "seeding" || status === "running" || status === "grading"
	);
}

/** "budget_exhausted" → "budget exhausted" for display. */
export function statusLabel(status: string): string {
	return status.replace(/_/g, " ");
}
