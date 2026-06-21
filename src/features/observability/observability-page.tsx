"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { EmptyState, ErrorState, PageFade, PageSection } from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";
import { aggregateRunCards } from "./eval-metrics";
import { isRunActive } from "./eval-status";
import { InternalGate } from "./internal-gate";
import { RunCardsGrid } from "./run-cards";
import { filtersToRequest, RunFilters, useEvalRunFilters } from "./run-filters";
import { RunsTable } from "./runs-table";
import { useNow } from "./use-now";

const ACTIVE_REFETCH_MS = 5000;
const IDLE_REFETCH_MS = 30_000;

function ObservabilityInner() {
	const api = useApi();
	const queryClient = useQueryClient();
	const filters = useEvalRunFilters();
	const request = filtersToRequest(filters);
	const [cancelPendingId, setCancelPendingId] = useState<string | null>(null);

	const { data, error, isError, isPending, refetch } = useQuery({
		queryFn: () => api.listEvalRuns(request),
		queryKey: ["eval-runs", request],
		refetchInterval: (query) => {
			const runs = query.state.data?.runs ?? [];
			return runs.some((run) => isRunActive(run.status)) ? ACTIVE_REFETCH_MS : IDLE_REFETCH_MS;
		},
		staleTime: 2000,
	});

	const runs = data?.runs ?? [];
	const anyActive = runs.some((run) => isRunActive(run.status));
	const now = useNow(anyActive);
	const cards = useMemo(() => aggregateRunCards(runs, now), [runs, now]);

	const cancelMutation = useMutation({
		mutationFn: (runId: string) => api.cancelEvalRun(runId),
		onMutate: (runId) => setCancelPendingId(runId),
		onSettled: () => {
			setCancelPendingId(null);
			void queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
			void queryClient.invalidateQueries({ queryKey: ["eval-run"] });
		},
	});

	const hasFilters =
		filters.statuses.length > 0 ||
		filters.suite !== null ||
		filters.model !== "" ||
		filters.from !== null ||
		filters.to !== null;

	return (
		<PageShell maxWidth={1200} title="Observability">
			<PageFade>
				<RunCardsGrid cards={cards} />

				<PageSection title="Runs">
					<RunFilters filters={filters} />

					{cancelMutation.isError && (
						<p className="text-danger m-0 text-xs">
							Failed to cancel the run:{" "}
							{cancelMutation.error instanceof Error
								? cancelMutation.error.message
								: "unknown error"}
						</p>
					)}

					{isPending ? (
						<div className="flex flex-col gap-2">
							{["a", "b", "c", "d", "e"].map((key) => (
								<Skeleton className="h-10 w-full" key={key} />
							))}
						</div>
					) : isError ? (
						<ErrorState
							message={`Failed to load eval runs: ${error instanceof Error ? error.message : "unknown error"}`}
							onRetry={() => void refetch()}
						/>
					) : runs.length === 0 ? (
						<EmptyState
							message={hasFilters ? "No runs match these filters." : "No eval runs yet."}
						/>
					) : (
						<>
							<RunsTable
								cancelPendingId={cancelPendingId}
								now={now}
								onCancel={(runId) => cancelMutation.mutate(runId)}
								runs={runs}
							/>
							{data?.pagination.hasMore && (
								<p className="text-ink-subtle m-0 text-xs">
									Showing the first {runs.length} runs — narrow the filters to see older ones.
								</p>
							)}
						</>
					)}
				</PageSection>
			</PageFade>
		</PageShell>
	);
}

export function ObservabilityPage() {
	return (
		<InternalGate>
			<ObservabilityInner />
		</InternalGate>
	);
}
