"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HomeFeedItem, HomeSectionId } from "@unison/contracts";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import { notificationTargetHref } from "@/features/notifications/notification-target";
import { useApi } from "@/lib/api-context";
import { relativeTime } from "@/lib/relative-time";
import { Button } from "@/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Skeleton } from "@/ui/skeleton";

/** Null for notifications — their destination is the notification's own
 *  target (a session, usually), resolved on click via the detail endpoint. */
function targetHref(target: HomeFeedItem["target"]): string | null {
	switch (target.kind) {
		case "notification":
			return null;
		case "reminder":
			return "/reminders";
		case "session":
			return `/sessions/${target.sessionId}`;
	}
}

const ACTION_LABELS: Record<HomeFeedItem["actions"][number], string> = {
	complete: "Complete",
	disable: "Manage",
	dismiss: "Dismiss",
	open: "Open",
	snooze: "Snooze 1 hour",
};

function FeedItemActions({
	actions,
	onAction,
}: {
	actions: HomeFeedItem["actions"];
	onAction: (action: HomeFeedItem["actions"][number]) => void;
}) {
	const [open, setOpen] = useState(false);

	if (actions.length === 0) return null;

	function select(action: HomeFeedItem["actions"][number]) {
		setOpen(false);
		onAction(action);
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					aria-label="Item actions"
					className="text-ink-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-(--border) bg-transparent hover:bg-surface hover:text-ink data-[state=open]:bg-surface data-[state=open]:text-ink"
					type="button"
				>
					<Ellipsis size={16} />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-40 p-1" sideOffset={6}>
				{actions.map((action) => (
					<button
						className="text-ink-muted hover:bg-primary-soft hover:text-ink flex h-8 w-full items-center rounded-md border-none bg-transparent px-2 text-left text-sm"
						key={action}
						onClick={() => select(action)}
						type="button"
					>
						{ACTION_LABELS[action]}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}

function FeedItemRow({
	item,
	onAction,
	onOpen,
}: {
	item: HomeFeedItem;
	onAction: (action: HomeFeedItem["actions"][number]) => void;
	onOpen: () => void;
}) {
	const href = targetHref(item.target);
	const content = (
		<>
			<p
				className="type-small"
				style={{
					color: "var(--ink)",
					fontWeight: item.unread ? 500 : 400,
					margin: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{item.title}
			</p>
			{item.body && (
				<p
					className="type-extrasmall"
					style={{
						color: "var(--ink-subtle)",
						margin: "2px 0 0",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{item.body}
				</p>
			)}
			<p className="type-extrasmall" style={{ color: "var(--ink-subtle)", margin: "2px 0 0" }}>
				{relativeTime(item.occurredAt)}
			</p>
		</>
	);
	return (
		<div className="-mx-2 flex items-start gap-3 rounded-md px-2 py-[10px] hover:bg-primary-soft">
			{href ? (
				<Link className="min-w-0 flex-1 no-underline" href={href}>
					{content}
				</Link>
			) : (
				<button
					className="min-w-0 flex-1 border-none bg-transparent p-0 text-left"
					onClick={onOpen}
					type="button"
				>
					{content}
				</button>
			)}
			<FeedItemActions actions={item.actions} onAction={onAction} />
		</div>
	);
}

function SectionSkeleton() {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
			{[1, 2, 3].map((i) => (
				<div key={i} style={{ alignItems: "center", display: "flex", padding: "10px 0" }}>
					<div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "6px" }}>
						<Skeleton style={{ height: "14px", width: "70%" }} />
						<Skeleton style={{ height: "12px", width: "45%" }} />
					</div>
				</div>
			))}
		</div>
	);
}

type FeedSectionProps = {
	sectionId: HomeSectionId;
};

/** A home feed section that loads independently (screens.md §1): it fetches
 *  its own `/v1/home/sections/:sectionId` and owns its skeleton/error states,
 *  so one slow section never blocks the others. */
export function FeedSection({ sectionId }: FeedSectionProps) {
	const api = useApi();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [openFailed, setOpenFailed] = useState(false);

	// A notification row leads to whatever its intent targets (usually the
	// session that raised it) — resolved via the detail endpoint on click.
	async function openNotificationTarget(notificationId: string) {
		setOpenFailed(false);
		void api.markNotificationOpened(notificationId).catch(() => {});
		try {
			const detail = await queryClient.fetchQuery({
				queryFn: () => api.getNotification(notificationId),
				queryKey: ["notifications", notificationId],
				staleTime: 15_000,
			});
			router.push(notificationTargetHref(detail.target));
		} catch {
			setOpenFailed(true);
		}
	}

	const { data, isError, isLoading, refetch } = useQuery({
		queryFn: () => api.getHomeSection(sectionId),
		queryKey: ["home-section", sectionId],
		staleTime: 60_000,
	});

	// Item mutations refresh this section AND the sibling page caches, so the
	// notifications/reminders pages (and bell popover) don't show stale rows.
	function invalidateAfter(item: HomeFeedItem) {
		void queryClient.invalidateQueries({ queryKey: ["home-section", sectionId] });
		if (item.target.kind === "notification") {
			void queryClient.invalidateQueries({ queryKey: ["notifications"] });
		}
		if (item.target.kind === "reminder") {
			void queryClient.invalidateQueries({ queryKey: ["reminders"] });
		}
	}

	const dismissMutation = useMutation({
		mutationFn: async (item: HomeFeedItem) => {
			if (item.target.kind !== "notification") {
				throw new Error("Only notifications can be dismissed.");
			}
			return api.dismissNotification(item.target.notificationId);
		},
		onSuccess: (_, item) => invalidateAfter(item),
	});

	const completeMutation = useMutation({
		mutationFn: async (item: HomeFeedItem) => {
			if (item.target.kind !== "reminder") {
				throw new Error("Only reminders can be completed.");
			}
			return api.completeReminder(item.target.reminderId);
		},
		onSuccess: (_, item) => invalidateAfter(item),
	});

	const snoozeMutation = useMutation({
		mutationFn: async (item: HomeFeedItem) => {
			const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
			if (item.target.kind === "notification") {
				return api.snoozeNotification(item.target.notificationId, { snoozedUntil });
			}
			if (item.target.kind === "reminder") {
				return api.snoozeReminder(item.target.reminderId, { snoozedUntil });
			}
			throw new Error("This item can't be snoozed.");
		},
		onSuccess: (_, item) => invalidateAfter(item),
	});

	function handleAction(item: HomeFeedItem, action: HomeFeedItem["actions"][number]) {
		if (action === "open" || action === "disable") {
			if (item.target.kind === "notification") {
				void openNotificationTarget(item.target.notificationId);
				return;
			}
			const href = targetHref(item.target);
			if (href) router.push(href);
			return;
		}
		if (action === "dismiss") {
			dismissMutation.mutate(item);
			return;
		}
		if (action === "complete") {
			completeMutation.mutate(item);
			return;
		}
		if (action === "snooze") {
			snoozeMutation.mutate(item);
		}
	}

	const mutationError = dismissMutation.isError
		? "Failed to dismiss. Try again."
		: completeMutation.isError
			? "Failed to complete. Try again."
			: snoozeMutation.isError
				? "Failed to snooze. Try again."
				: openFailed
					? "Could not open notification. Try again."
					: null;

	const section = data?.section;

	return (
		<div>
			<h2
				className="type-small"
				style={{
					color: "var(--ink-subtle)",
					fontWeight: 500,
					margin: "0 0 4px",
					textTransform: "uppercase",
				}}
			>
				{section?.title ?? sectionId.replace(/_/g, " ")}
				{section && section.totalCount > 0 && (
					<span style={{ color: "var(--ink-subtle)", fontWeight: 400, marginLeft: "6px" }}>
						{section.totalCount}
					</span>
				)}
			</h2>
			{isLoading && <SectionSkeleton />}
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
						Could not load this section.
					</p>
					<Button onClick={() => void refetch()} size="sm" variant="secondary">
						Retry
					</Button>
				</div>
			)}
			{mutationError && (
				<p className="type-extrasmall" style={{ color: "var(--danger)", margin: "4px 0" }}>
					{mutationError}
				</p>
			)}
			{section && section.items.length === 0 && (
				<p className="type-small" style={{ color: "var(--ink-subtle)", padding: "10px 0" }}>
					All clear.
				</p>
			)}
			{section && section.items.length > 0 && (
				<div>
					{section.items.map((item, index) => (
						<Fragment key={item.id}>
							<FeedItemRow
								item={item}
								onAction={(action) => handleAction(item, action)}
								onOpen={() => {
									if (item.target.kind === "notification") {
										void openNotificationTarget(item.target.notificationId);
									}
								}}
							/>
							{index < section.items.length - 1 && <div aria-hidden className="h-px bg-(--line)" />}
						</Fragment>
					))}
				</div>
			)}
		</div>
	);
}
