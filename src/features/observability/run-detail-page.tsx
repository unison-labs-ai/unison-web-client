"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag } from "lucide-react";
import { notFound } from "next/navigation";
import { useRef } from "react";

import { PageShell } from "@/features/shell/page-shell";
import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { Badge } from "@/ui/badge";
import { Breadcrumb } from "@/ui/breadcrumb";
import { Button } from "@/ui/button";
import { ErrorState, PageFade, PageSection } from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";
import { AnimatedSummaryStyles, HashChip } from "./display";
import {
	isItemActive,
	isRunActive,
	isRunCancellable,
	RUN_STATUS_BADGE_VARIANT,
	statusLabel,
} from "./eval-status";
import { InternalGate } from "./internal-gate";
import {
	BaselineSection,
	CandidateSection,
	FailuresSection,
	RetentionSection,
	ReviewQueueSection,
	ScorecardSection,
	ToolWaterfallSection,
	UsageChartsSection,
} from "./run-detail-sections";
import { RunItemsTable } from "./run-items-table";
import { useEvalRunLive } from "./use-eval-run-live";
import { useNow } from "./use-now";

const DEGRADED_POLL_MS = 5000;

function RunDetailSkeleton() {
	return (
		<PageShell maxWidth={1200}>
			<div className="flex flex-col gap-4">
				<Skeleton className="h-4 w-56" />
				<Skeleton className="h-7 w-72" />
				<div className="grid gap-4 md:grid-cols-2">
					<Skeleton className="h-44 w-full" />
					<Skeleton className="h-44 w-full" />
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		</PageShell>
	);
}

function RunDetailInner({ runId }: { runId: string }) {
	const api = useApi();
	const queryClient = useQueryClient();

	// The live hook needs the run status (from the query) and the query's
	// fallback polling needs the stream health (from the hook) — a ref breaks
	// the cycle; the interval re-evaluates on every re-render anyway.
	const streamDegradedRef = useRef(false);

	const { data, error, isError, isPending, refetch } = useQuery({
		queryFn: () => api.getEvalRun(runId),
		queryKey: ["eval-run", runId],
		refetchInterval: (query) => {
			// SSE drives refreshes while healthy; poll only as the fallback.
			const run = query.state.data?.run;
			return run && isRunActive(run.status) && streamDegradedRef.current ? DEGRADED_POLL_MS : false;
		},
		staleTime: 1000,
	});

	const active = data ? isRunActive(data.run.status) : false;
	const { degraded: streamDegraded } = useEvalRunLive({ active, runId });
	streamDegradedRef.current = streamDegraded;
	const anyItemActive = active || (data?.items.some((item) => isItemActive(item.status)) ?? false);
	const now = useNow(anyItemActive);

	const cancelMutation = useMutation({
		mutationFn: () => api.cancelEvalRun(runId),
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: ["eval-run", runId] });
			void queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
		},
	});

	const blessMutation = useMutation({
		mutationFn: () => api.blessEvalRun(runId),
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: ["eval-run", runId] });
			void queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
		},
	});

	if (isPending) return <RunDetailSkeleton />;

	if (isError) {
		if (error instanceof WebApiError && error.status === 404) {
			notFound();
		}
		return (
			<PageShell maxWidth={1200}>
				<ErrorState
					message={`Failed to load the run: ${error instanceof Error ? error.message : "unknown error"}`}
					onRetry={() => void refetch()}
				/>
			</PageShell>
		);
	}

	if (!data) return <RunDetailSkeleton />;
	const { run } = data;

	return (
		<PageShell maxWidth={1200}>
			<AnimatedSummaryStyles />

			{/* Breadcrumb + header (detail-page pattern, e.g. automation run detail) */}
			<Breadcrumb
				className="mb-3"
				currentTag="span"
				items={[{ href: "/observability", label: "Observability" }, { label: run.title }]}
			/>
			<div className="mb-6 md:pr-[var(--app-top-actions-reserve)]">
				<div className="flex items-center gap-3">
					<h1
						className="m-0 min-w-0 flex-1 truncate text-ink"
						style={{ fontSize: "20px", fontWeight: 500 }}
						title={run.title}
					>
						{run.title}
					</h1>
					<div className="flex shrink-0 items-center gap-2">
						{isRunCancellable(run.status) && (
							<Button
								disabled={cancelMutation.isPending}
								onClick={() => cancelMutation.mutate()}
								size="sm"
								variant="destructive"
							>
								<Ban size={12} />
								{cancelMutation.isPending ? "Cancelling…" : "Cancel run"}
							</Button>
						)}
						{run.status === "completed" && (
							<Button
								disabled={blessMutation.isPending || blessMutation.isSuccess}
								onClick={() => blessMutation.mutate()}
								size="sm"
								variant="secondary"
							>
								<Flag size={12} />
								{blessMutation.isSuccess
									? "Blessed as baseline"
									: blessMutation.isPending
										? "Blessing…"
										: "Bless as baseline"}
							</Button>
						)}
					</div>
				</div>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<Badge variant={RUN_STATUS_BADGE_VARIANT[run.status]}>{statusLabel(run.status)}</Badge>
					<Badge>{run.suiteId}</Badge>
					<span className="flex items-center gap-1.5">
						<span className="text-ink-muted font-mono text-xs">{run.candidate.model}</span>
						<HashChip candidate={run.candidate} hash={run.candidateConfigHash} />
					</span>
				</div>
			</div>

			<PageFade>
				{(cancelMutation.isError || blessMutation.isError) && (
					<p className="text-danger m-0 text-xs">
						{cancelMutation.isError ? "Failed to cancel the run." : "Failed to bless the run."} Try
						again.
					</p>
				)}

				{active && streamDegraded && (
					<p className="bg-warning-soft text-ink-muted m-0 rounded-md px-3 py-1.5 text-xs">
						Live event stream interrupted — falling back to 5s polling.
					</p>
				)}

				{/* Sections, in spec §6 order */}
				<ScorecardSection run={run} />
				<BaselineSection detail={data} />
				<UsageChartsSection items={data.items} />
				<ToolWaterfallSection items={data.items} />
				<FailuresSection items={data.items} />
				<PageSection title={`Run items (${data.items.length})`}>
					{data.items.length === 0 ? (
						<p className="text-ink-subtle m-0 py-4 text-center text-xs">No items yet.</p>
					) : (
						<RunItemsTable items={data.items} now={now} />
					)}
				</PageSection>
				<ReviewQueueSection detail={data} />
				<div className="grid gap-4 md:grid-cols-2">
					<CandidateSection run={run} />
					<RetentionSection run={run} />
				</div>
			</PageFade>
		</PageShell>
	);
}

export function EvalRunDetailPage({ runId }: { runId: string }) {
	return (
		<InternalGate>
			<RunDetailInner runId={runId} />
		</InternalGate>
	);
}
