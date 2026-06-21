"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentToolApproval } from "@unison/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { ApprovalCard } from "@/ui/approval-card";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { groupBySession } from "./group-approvals";

export function ApprovalsPage() {
	const api = useApi();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const router = useRouter();

	const view = searchParams.get("view") === "history" ? "history" : "pending";

	const pendingQuery = useQuery({
		enabled: view === "pending",
		queryFn: () => api.listPendingApprovals(),
		queryKey: ["approvals", "pending"],
		staleTime: 15_000,
	});

	// History/audit view: omitting `status` returns approvals in every state
	// (newest first); past decisions are everything that is no longer pending.
	const historyQuery = useQuery({
		enabled: view === "history",
		queryFn: () => api.listApprovals({}),
		queryKey: ["approvals", "all"],
		staleTime: 15_000,
	});

	const activeQuery = view === "pending" ? pendingQuery : historyQuery;
	const { isLoading, isError, refetch } = activeQuery;

	const decideMutation = useMutation({
		mutationFn: ({
			approvalId,
			decision,
		}: {
			approvalId: string;
			decision: "approve" | "reject";
		}) => api.decideApproval(approvalId, { decision }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["approvals"] });
		},
	});

	function setView(newView: "pending" | "history") {
		const params = new URLSearchParams(searchParams.toString());
		if (newView === "pending") {
			params.delete("view");
		} else {
			params.set("view", newView);
		}
		router.replace(`/approvals?${params.toString()}`);
	}

	async function approveAllInSession(sessionApprovals: AgentToolApproval[]) {
		const pending = sessionApprovals.filter((a) => a.status === "pending");
		try {
			await Promise.all(
				pending.map((a) => decideMutation.mutateAsync({ approvalId: a.id, decision: "approve" })),
			);
		} catch {
			// surfaced via decideMutation.isError below
		}
	}

	const pendingApprovals = (pendingQuery.data ?? []).filter((a) => a.status === "pending");
	const historyApprovals = (historyQuery.data ?? []).filter((a) => a.status !== "pending");
	const grouped = groupBySession(pendingApprovals);
	const isEmpty =
		view === "pending" ? pendingApprovals.length === 0 : historyApprovals.length === 0;

	return (
		<PageShell title="Approvals">
			{/* Tab strip */}
			<div
				style={{
					borderBottom: "1px solid var(--border)",
					display: "flex",
					gap: "0",
					marginBottom: "24px",
				}}
			>
				{(["pending", "history"] as const).map((tab) => (
					<button
						key={tab}
						onClick={() => setView(tab)}
						style={{
							background: "none",
							border: "none",
							borderBottom: view === tab ? "2px solid var(--ink)" : "2px solid transparent",
							color: view === tab ? "var(--ink)" : "var(--ink-subtle)",
							fontSize: "13px",
							fontWeight: view === tab ? 500 : 400,
							marginBottom: "-1px",
							padding: "8px 16px",
						}}
						type="button"
					>
						{tab === "pending" ? "Pending" : "History"}
					</button>
				))}
			</div>

			{/* Loading */}
			{isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} style={{ height: "120px", width: "100%" }} />
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
						Failed to load approvals.
					</p>
					<Button onClick={() => void refetch()} variant="secondary">
						Retry
					</Button>
				</div>
			)}

			{/* Decision failure */}
			{decideMutation.isError && (
				<p className="type-small" style={{ color: "var(--danger)", margin: "0 0 12px" }}>
					Failed to submit decision. Try again.
				</p>
			)}

			{/* Empty state */}
			{!isLoading && !isError && isEmpty && (
				<p
					className="type-small"
					style={{ color: "var(--ink-subtle)", margin: 0, padding: "24px 0" }}
				>
					{view === "pending"
						? "No pending approvals — you're all caught up."
						: "No past decisions yet."}
				</p>
			)}

			{/* Pending — grouped by session, with inline decide actions */}
			{view === "pending" && !isLoading && !isError && grouped.size > 0 && (
				<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
					{Array.from(grouped.entries()).map(([sessionId, sessionApprovals]) => (
						<div key={sessionId}>
							{/* Session section header */}
							<div
								style={{
									alignItems: "center",
									display: "flex",
									justifyContent: "space-between",
									marginBottom: "8px",
								}}
							>
								<p
									className="type-small"
									style={{
										color: "var(--ink-subtle)",
										margin: 0,
										textTransform: "uppercase",
									}}
								>
									Session: {sessionId.slice(0, 8)}&hellip;
								</p>
								<Button
									disabled={decideMutation.isPending}
									onClick={() => void approveAllInSession(sessionApprovals)}
									size="sm"
									variant="secondary"
								>
									Approve all in session
								</Button>
							</div>

							{/* Approval cards */}
							<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
								{sessionApprovals.map((approval) => (
									<ApprovalCard
										approval={approval}
										key={approval.id}
										onDecide={(decision) =>
											decideMutation.mutate({ approvalId: approval.id, decision })
										}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{/* History — audit trail, newest first, read-only status badges */}
			{view === "history" && !isLoading && !isError && historyApprovals.length > 0 && (
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					{historyApprovals.map((approval) => (
						<ApprovalCard approval={approval} key={approval.id} readOnly />
					))}
				</div>
			)}
		</PageShell>
	);
}
