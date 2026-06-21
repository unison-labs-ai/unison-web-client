"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Reminder } from "@unison/contracts";
import { AlertCircle, Check, Clock } from "lucide-react";
import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import {
	getReminderGroup,
	type ReminderGroup,
	reminderBadgeLabel,
	reminderBadgeVariant,
} from "./reminder-grouping";

function formatDueDate(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function ReminderRow({ reminder, group }: { reminder: Reminder; group: ReminderGroup }) {
	const api = useApi();
	const queryClient = useQueryClient();

	const completeMutation = useMutation({
		mutationFn: () => api.completeReminder(reminder.id),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["reminders"] });
		},
	});

	const snoozeMutation = useMutation({
		mutationFn: () =>
			api.snoozeReminder(reminder.id, {
				snoozedUntil: new Date(Date.now() + 3_600_000).toISOString(),
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["reminders"] });
		},
	});

	const isDone = group === "done";
	const isMutating = completeMutation.isPending || snoozeMutation.isPending;

	return (
		<div
			style={{
				background: "var(--surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius)",
				display: "flex",
				flexDirection: "column",
				gap: "6px",
				padding: "14px 16px",
			}}
		>
			{/* Top row: title + action buttons */}
			<div
				style={{
					alignItems: "flex-start",
					display: "flex",
					gap: "8px",
					justifyContent: "space-between",
				}}
			>
				<span
					style={{
						color: "var(--ink)",
						fontSize: "14px",
						fontWeight: 500,
						lineHeight: "1.4",
					}}
				>
					{reminder.title}
				</span>

				{!isDone && (
					<div style={{ display: "flex", flexShrink: 0, gap: "4px" }}>
						<button
							aria-label="Snooze reminder for 1 hour"
							disabled={isMutating}
							onClick={() => void snoozeMutation.mutate()}
							style={{
								alignItems: "center",
								background: "none",
								border: "none",
								borderRadius: "var(--radius-sm)",
								color: "var(--ink-subtle)",
								display: "flex",
								justifyContent: "center",
								opacity: isMutating ? 0.5 : 1,
								padding: "2px",
							}}
							title="Snooze 1 hour"
							type="button"
						>
							<Clock size={14} />
						</button>
						<button
							aria-label="Complete reminder"
							disabled={isMutating}
							onClick={() => void completeMutation.mutate()}
							style={{
								alignItems: "center",
								background: "none",
								border: "none",
								borderRadius: "var(--radius-sm)",
								color: "var(--ink-subtle)",
								display: "flex",
								justifyContent: "center",
								opacity: isMutating ? 0.5 : 1,
								padding: "2px",
							}}
							title="Mark complete"
							type="button"
						>
							<Check size={14} />
						</button>
					</div>
				)}
			</div>

			{/* Body */}
			{reminder.body && (
				<p
					style={{
						color: "var(--ink-muted)",
						fontSize: "12px",
						lineHeight: "1.5",
						margin: 0,
					}}
				>
					{reminder.body}
				</p>
			)}

			{/* Action failure */}
			{(completeMutation.isError || snoozeMutation.isError) && (
				<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>
					{completeMutation.isError ? "Failed to complete." : "Failed to snooze."} Try again.
				</p>
			)}

			{/* Footer: status badge + due date */}
			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexWrap: "wrap",
					gap: "6px",
					marginTop: "2px",
				}}
			>
				<Badge variant={reminderBadgeVariant(group)}>{reminderBadgeLabel(reminder, group)}</Badge>
				<span style={{ color: "var(--ink-subtle)", fontSize: "12px", marginLeft: "auto" }}>
					{formatDueDate(reminder.dueAt)}
				</span>
			</div>
		</div>
	);
}

function GroupSection({
	title,
	reminders,
	group,
}: {
	title: string;
	reminders: Reminder[];
	group: ReminderGroup;
}) {
	if (reminders.length === 0) return null;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
			<p
				className="type-small"
				style={{
					color: "var(--ink-subtle)",
					margin: 0,
					textTransform: "uppercase",
				}}
			>
				{title} ({reminders.length})
			</p>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				{reminders.map((reminder) => (
					<ReminderRow group={group} key={reminder.id} reminder={reminder} />
				))}
			</div>
		</div>
	);
}

export function RemindersPage() {
	const api = useApi();

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listReminders(),
		queryKey: ["reminders"],
		staleTime: 15_000,
	});

	const reminders: Reminder[] = data?.reminders ?? [];

	const overdue = reminders.filter((r) => getReminderGroup(r) === "overdue");
	const upcoming = reminders.filter((r) => getReminderGroup(r) === "upcoming");
	const done = reminders.filter((r) => getReminderGroup(r) === "done");

	const hasAny = reminders.length > 0;

	return (
		<PageShell title="Reminders">
			{/* Loading */}
			{isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
					{[1, 2, 3, 4, 5].map((i) => (
						<Skeleton key={i} style={{ height: "80px", width: "100%" }} />
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
					<div style={{ alignItems: "center", display: "flex", gap: "8px" }}>
						<AlertCircle size={16} style={{ color: "var(--danger)" }} />
						<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
							Failed to load reminders.
						</p>
					</div>
					<Button onClick={() => void refetch()} variant="secondary">
						Retry
					</Button>
				</div>
			)}

			{/* Empty */}
			{!isLoading && !isError && !hasAny && (
				<p
					className="type-small"
					style={{
						color: "var(--ink-subtle)",
						margin: 0,
						padding: "24px 0",
						textAlign: "center",
					}}
				>
					No reminders
				</p>
			)}

			{/* Grouped reminder sections */}
			{!isLoading && !isError && hasAny && (
				<div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
					<GroupSection group="overdue" reminders={overdue} title="Overdue" />
					<GroupSection group="upcoming" reminders={upcoming} title="Upcoming" />
					<GroupSection group="done" reminders={done} title="Done" />
				</div>
			)}
		</PageShell>
	);
}
