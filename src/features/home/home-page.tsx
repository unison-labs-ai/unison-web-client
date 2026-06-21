"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentToolApprovalDecisionRequest, HomeSectionId } from "@unison/contracts";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader, PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { ApprovalCard } from "@/ui/approval-card";
import { Button } from "@/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { SessionRow } from "@/ui/session-row";
import { Skeleton } from "@/ui/skeleton";
import { Composer } from "./composer";
import { FeedSection } from "./feed-section";

/** Pending approvals — the home read-model composes notifications/reminders/
 *  sessions but not approvals, so this block fills screens.md §1's "Needs
 *  attention" approval cards from the approvals endpoint directly. */
function PendingApprovalsBlock() {
	const api = useApi();
	const queryClient = useQueryClient();

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listPendingApprovals(),
		queryKey: ["approvals", "pending"],
		staleTime: 30_000,
	});

	const decideMutation = useMutation({
		mutationFn: ({
			approvalId,
			request,
		}: {
			approvalId: string;
			request: AgentToolApprovalDecisionRequest;
		}) => api.decideApproval(approvalId, request),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["approvals"] });
		},
	});

	const pending = (data ?? []).filter((approval) => approval.status === "pending");
	// Loaded and empty → no block at all; loading/error must stay visible
	// (this is the highest-stakes section — a silent failure hides approvals).
	if (!isLoading && !isError && pending.length === 0) return null;

	return (
		<div style={{ marginBottom: "32px" }}>
			<h2
				className="type-small"
				style={{
					color: "var(--ink-subtle)",
					fontWeight: 500,
					margin: "0 0 8px",
					textTransform: "uppercase",
				}}
			>
				Needs attention
			</h2>
			{isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					{[1, 2].map((i) => (
						<Skeleton key={i} style={{ height: "96px", width: "100%" }} />
					))}
				</div>
			)}
			{isError && (
				<div
					style={{
						alignItems: "center",
						background: "var(--danger-soft)",
						borderRadius: "var(--radius-md)",
						display: "flex",
						gap: "10px",
						justifyContent: "space-between",
						padding: "10px 12px",
					}}
				>
					<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
						Could not load pending approvals.
					</p>
					<Button onClick={() => void refetch()} size="sm" variant="secondary">
						Retry
					</Button>
				</div>
			)}
			{!isLoading && !isError && (
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					{pending.slice(0, 5).map((approval) => (
						<ApprovalCard
							approval={approval}
							key={approval.id}
							onDecide={(request) => decideMutation.mutate({ approvalId: approval.id, request })}
						/>
					))}
					{decideMutation.isError && (
						<p className="type-extrasmall" style={{ color: "var(--danger)", margin: 0 }}>
							Failed to submit decision. Try again.
						</p>
					)}
					{pending.length > 5 && (
						<Link
							className="type-extrasmall text-ink-muted no-underline hover:text-ink"
							href="/approvals"
						>
							All {pending.length} approvals →
						</Link>
					)}
				</div>
			)}
		</div>
	);
}

function greeting(name: string | null | undefined, hour: number | null): string {
	const base =
		hour === null
			? "Hello"
			: hour < 12
				? "Good morning"
				: hour < 17
					? "Good afternoon"
					: "Good evening";
	const first = name?.trim().split(/\s+/)[0];
	return first ? `${base}, ${first}` : base;
}

const SUGGESTIONS = [
	"Summarize what happened while I was away",
	"Show me pending approvals",
	"What's on my reminders?",
];

// Server-composed order of /v1/home (services/api homeSectionOrder). Each
// section self-fetches its own endpoint so they load independently.
const HOME_SECTION_IDS: HomeSectionId[] = ["notifications", "ready_for_review", "reminders"];

export function HomePage() {
	const api = useApi();
	const [composerValue, setComposerValue] = useState("");
	// Time-of-day greeting is gated behind mount: reading the clock during the
	// first render of a prerendered client component guarantees a hydration
	// mismatch whenever server/client hours differ.
	const [hour, setHour] = useState<number | null>(null);

	useEffect(() => {
		setHour(new Date().getHours());
	}, []);

	const { data: meData } = useQuery({
		queryFn: () => api.getMe(),
		queryKey: ["me"],
		staleTime: 300_000,
	});

	const {
		data: threadsData,
		isLoading: threadsLoading,
		isError: threadsError,
		refetch: refetchThreads,
	} = useQuery({
		queryFn: () => api.listThreads({ limit: 100 }),
		queryKey: ["threads"],
		staleTime: 30_000,
	});

	const recentSessions = threadsData?.threads.slice(0, 5) ?? [];
	const showSuggestions = !threadsLoading && !threadsError && recentSessions.length === 0;
	const displayName = meData?.profile?.displayName ?? meData?.profile?.email;

	return (
		<PageShell>
			{/* Hero: greeting + composer */}
			<div style={{ marginBottom: "40px" }}>
				<PageHeader title={greeting(displayName, hour)} />
				<Composer onChange={setComposerValue} value={composerValue} />
				{showSuggestions && (
					<div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
						{SUGGESTIONS.map((s) => (
							<button
								className="type-small"
								key={s}
								onClick={() => setComposerValue(s)}
								style={{
									background: "none",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius-md)",
									color: "var(--ink-subtle)",
									padding: "8px 12px",
									textAlign: "left",
									width: "100%",
								}}
								type="button"
							>
								{s}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Needs attention — approval cards (screens.md §1/§6) */}
			<PendingApprovalsBlock />

			{/* Home feed sections — each loads independently with its own
			    skeleton/error (screens.md §1), so nothing gates on a composed call. */}
			<div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
				{HOME_SECTION_IDS.map((sectionId) => (
					<FeedSection key={sectionId} sectionId={sectionId} />
				))}
			</div>

			{/* Recent activity */}
			<div style={{ marginTop: "40px" }}>
				<div
					style={{
						alignItems: "center",
						display: "flex",
						justifyContent: "space-between",
						marginBottom: "4px",
					}}
				>
					<h2
						className="type-small"
						style={{
							color: "var(--ink-subtle)",
							fontWeight: 500,
							margin: 0,
							textTransform: "uppercase",
						}}
					>
						Recent activity
					</h2>
					<Popover>
						<PopoverTrigger asChild>
							<button
								aria-label="Recent activity actions"
								className="text-ink-subtle flex h-8 w-8 items-center justify-center rounded-md border border-(--border) bg-transparent hover:bg-surface hover:text-ink data-[state=open]:bg-surface data-[state=open]:text-ink"
								type="button"
							>
								<Ellipsis size={16} />
							</button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-40 p-1" sideOffset={6}>
							<Link
								className="text-ink-muted hover:bg-primary-soft hover:text-ink flex h-8 items-center rounded-md px-2 text-sm no-underline"
								href="/sessions"
							>
								All sessions
							</Link>
						</PopoverContent>
					</Popover>
				</div>
				{threadsLoading && (
					<div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "8px" }}>
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} style={{ height: "40px", width: "100%" }} />
						))}
					</div>
				)}
				{threadsError && (
					<div
						style={{
							alignItems: "center",
							display: "flex",
							flexDirection: "column",
							gap: "10px",
							padding: "16px 0",
						}}
					>
						<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
							Could not load recent sessions.
						</p>
						<Button onClick={() => void refetchThreads()} variant="secondary">
							Retry
						</Button>
					</div>
				)}
				{!threadsLoading && !threadsError && recentSessions.length === 0 && (
					<p className="type-small" style={{ color: "var(--ink-subtle)", padding: "10px 0" }}>
						No sessions yet. Start one above.
					</p>
				)}
				{recentSessions.map((session) => (
					<SessionRow key={session.id} session={session} />
				))}
			</div>
		</PageShell>
	);
}
