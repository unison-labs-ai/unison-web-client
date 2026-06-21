"use client";

import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/lib/api-context";
import { Skeleton } from "@/ui/skeleton";
import type { TranscriptModule } from "../types";

// The recording transcript view: read-only, fetched by capture id. Manages its
// own header (the canvas skips the shared one for this kind), matching the
// document/report views' shape.

export function TranscriptModuleView({ module }: { module: TranscriptModule }) {
	const api = useApi();
	const transcriptQuery = useQuery({
		queryFn: () => api.getCaptureTranscript(module.captureId),
		queryKey: ["capture-transcript", module.captureId],
		staleTime: 60_000,
	});

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-(--line) px-4 py-2.5">
				<span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{module.title}</span>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				{transcriptQuery.isError ? (
					<p className="text-sm text-danger">Failed to load this transcript.</p>
				) : transcriptQuery.isLoading || !transcriptQuery.data ? (
					<div className="flex flex-col gap-3">
						<Skeleton style={{ height: "16px", width: "100%" }} />
						<Skeleton style={{ height: "16px", width: "92%" }} />
						<Skeleton style={{ height: "16px", width: "96%" }} />
					</div>
				) : transcriptQuery.data.transcript.trim().length > 0 ? (
					<p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
						{transcriptQuery.data.transcript}
					</p>
				) : (
					<p className="text-sm text-ink-subtle">No transcript was saved for this recording.</p>
				)}
			</div>
		</div>
	);
}
