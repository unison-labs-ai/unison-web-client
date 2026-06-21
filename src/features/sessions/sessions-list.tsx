"use client";

import { useQuery } from "@tanstack/react-query";
import { type ThreadOrigin, threadOriginSchema } from "@unison/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import { SessionRow } from "@/ui/session-row";
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/ui/utils";

type FilterOption = {
	label: string;
	value: ThreadOrigin | "all";
};

const FILTERS: FilterOption[] = [
	{ label: "All", value: "all" },
	{ label: "Chat", value: "user" },
	{ label: "Capture", value: "capture" },
	{ label: "Automation", value: "automation" },
	{ label: "Connector", value: "connector" },
	{ label: "System", value: "system" },
];

export function SessionsList() {
	const api = useApi();
	const searchParams = useSearchParams();
	const router = useRouter();
	// Validate the URL param against the contract enum — unknown values fall
	// back to "all" instead of an unvalidated cast.
	const parsedOrigin = threadOriginSchema.safeParse(searchParams.get("origin"));
	const activeOrigin: ThreadOrigin | "all" = parsedOrigin.success ? parsedOrigin.data : "all";

	// limit: 100 is the backend max — without it the list silently caps at 25.
	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listThreads({ limit: 100 }),
		queryKey: ["threads"],
		staleTime: 30_000,
	});

	const sessions = data?.threads ?? [];
	const filtered =
		activeOrigin === "all" ? sessions : sessions.filter((s) => s.origin === activeOrigin);

	function setFilter(value: ThreadOrigin | "all") {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "all") {
			params.delete("origin");
		} else {
			params.set("origin", value);
		}
		router.replace(`/sessions?${params.toString()}`);
	}

	return (
		<PageShell title="Sessions">
			{/* Filter chips */}
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "6px",
					marginBottom: "16px",
				}}
			>
				{FILTERS.map((f) => (
					<button
						className={cn(
							"rounded-pill border border-(--border) px-[10px] py-1 text-xs hover:bg-primary-soft hover:text-ink",
							activeOrigin === f.value ? "bg-primary-soft text-ink" : "bg-surface text-ink-subtle",
						)}
						key={f.value}
						onClick={() => setFilter(f.value)}
						style={{
							fontWeight: activeOrigin === f.value ? 500 : 400,
						}}
						type="button"
					>
						{f.label}
					</button>
				))}
			</div>

			{/* Loading */}
			{isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
					{[1, 2, 3, 4, 5].map((i) => (
						<Skeleton key={i} style={{ height: "44px", width: "100%" }} />
					))}
				</div>
			)}

			{/* Error */}
			{isError && (
				<div
					style={{
						alignItems: "center",
						display: "flex",
						flexDirection: "column",
						gap: "10px",
						padding: "24px 0",
					}}
				>
					<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
						Failed to load sessions.
					</p>
					<Button onClick={() => void refetch()} variant="secondary">
						Retry
					</Button>
				</div>
			)}

			{/* Empty state */}
			{!isLoading && !isError && filtered.length === 0 && (
				<div style={{ color: "var(--ink-subtle)", fontSize: "14px", padding: "24px 0" }}>
					{activeOrigin !== "all" ? (
						<p style={{ margin: 0 }}>
							No {activeOrigin} sessions.{" "}
							<button
								className="rounded-sm text-ink-muted hover:bg-primary-soft hover:text-ink"
								onClick={() => setFilter("all")}
								style={{
									background: "none",
									border: "none",
									fontSize: "inherit",
									padding: 0,
								}}
								type="button"
							>
								Clear filter
							</button>
						</p>
					) : (
						<p style={{ margin: 0 }}>No sessions yet. Start one from Home.</p>
					)}
				</div>
			)}

			{/* Session rows */}
			{!isLoading &&
				!isError &&
				filtered.map((session) => <SessionRow key={session.id} session={session} />)}
		</PageShell>
	);
}
