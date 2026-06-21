"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationIntent, NotificationListResponse } from "@unison/contracts";
import { Bell, Inbox, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import {
	notificationTargetHref,
	visibleNotifications,
} from "@/features/notifications/notification-target";
import { useApi } from "@/lib/api-context";
import { relativeTime } from "@/lib/relative-time";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/ui/utils";

export function NotificationsButton({ onClick, open }: { onClick: () => void; open: boolean }) {
	const api = useApi();
	const { data } = useQuery({
		queryFn: () => api.listNotifications(),
		queryKey: ["notifications"],
		staleTime: 60_000,
	});
	const count = visibleNotifications(data?.notifications ?? []).length;

	return (
		<Button
			aria-label={count > 0 ? `${count} notifications` : "Notifications"}
			aria-pressed={open}
			className={cn(
				"relative h-10 w-10 text-ink-subtle hover:bg-surface hover:text-ink",
				open && "bg-surface text-ink",
			)}
			data-notifications-trigger=""
			onClick={onClick}
			size="icon"
			variant="ghost"
		>
			<Bell size={16} />
			{count > 0 ? (
				<span className="absolute right-0 top-0 flex h-[14px] min-w-[14px] translate-x-[40%] -translate-y-[40%] items-center justify-center rounded-pill bg-danger px-[3px] text-[10px] font-medium leading-none text-danger-foreground">
					{count > 9 ? "9+" : count}
				</span>
			) : null}
		</Button>
	);
}

function NotificationRow({
	notification,
	onDismiss,
	onOpen,
}: {
	notification: NotificationIntent;
	onDismiss: () => void;
	onOpen: () => void;
}) {
	const unread = notification.status === "pending";
	return (
		<div className="group relative -mx-2">
			<button
				className="flex w-full items-start gap-3 rounded-md border-none bg-transparent px-2 py-[10px] text-left outline-none hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-(--ring)"
				onClick={onOpen}
				type="button"
			>
				<span
					aria-hidden
					className={cn(
						"mt-[7px] h-1.5 w-1.5 shrink-0 rounded-pill",
						unread ? "bg-danger" : "bg-(--line)",
					)}
				/>
				<span className="min-w-0 flex-1">
					<span className="flex items-baseline justify-between gap-3">
						<span
							className={cn(
								"type-small min-w-0 truncate text-ink",
								unread ? "font-medium" : "font-normal",
							)}
						>
							{notification.title}
						</span>
						<span className="type-extrasmall shrink-0 text-ink-subtle group-hover:invisible">
							{relativeTime(notification.createdAt)}
						</span>
					</span>
					<span className="type-extrasmall mt-0.5 block truncate text-ink-subtle">
						{notification.body}
					</span>
				</span>
			</button>
			{/* Sibling (not nested) button so the row stays valid HTML. 40×40 to
			    match the app's icon-button geometry; replaces the timestamp on hover. */}
			<button
				aria-label="Dismiss notification"
				className="absolute right-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border-none bg-transparent text-ink-subtle hover:bg-surface hover:text-ink focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) group-hover:flex"
				onClick={onDismiss}
				type="button"
			>
				<X size={16} />
			</button>
		</div>
	);
}

function NotificationListSkeleton() {
	return (
		<div className="flex flex-col">
			{[0, 1, 2].map((row) => (
				<div className="flex flex-col gap-2 py-[12px]" key={row}>
					<Skeleton className="h-[14px] w-3/5" />
					<Skeleton className="h-[12px] w-4/5" />
				</div>
			))}
		</div>
	);
}

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
	const api = useApi();
	const queryClient = useQueryClient();
	const router = useRouter();
	const rootRef = useRef<HTMLDivElement>(null);

	const { data, isError, isLoading, refetch } = useQuery({
		queryFn: () => api.listNotifications(),
		queryKey: ["notifications"],
		staleTime: 60_000,
	});

	const notifications = visibleNotifications(data?.notifications ?? []);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && !event.defaultPrevented) onClose();
		}
		function onPointerDown(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (rootRef.current?.contains(target)) return;
			// The bell toggles on its own click — closing here too would reopen.
			if (target instanceof Element && target.closest("[data-notifications-trigger]")) return;
			onClose();
		}
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [onClose]);

	function openNotification(notification: NotificationIntent) {
		void api
			.markNotificationOpened(notification.id)
			.then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
			.catch(() => {});
		onClose();
		router.push(notificationTargetHref(notification.target));
	}

	function dismissNotification(notificationId: string) {
		// Drop the row immediately; reconcile with the server afterwards.
		queryClient.setQueryData(
			["notifications"],
			(current: NotificationListResponse | undefined) =>
				current && {
					...current,
					notifications: current.notifications.filter((n) => n.id !== notificationId),
				},
		);
		void api
			.dismissNotification(notificationId)
			.catch(() => {})
			.finally(() => {
				void queryClient.invalidateQueries({ queryKey: ["notifications"] });
				void queryClient.invalidateQueries({ queryKey: ["home-section"] });
			});
	}

	return (
		<div className="flex h-full flex-col" ref={rootRef}>
			{/* Same header recipe as PageShell/PageHeader: px-5 gutters, pt-12 on
			    desktop (title lines up with the page title), type-h3, 40px row. */}
			<header className="flex min-h-10 shrink-0 items-center justify-between gap-3 px-5 pb-4 pt-6 md:pb-6 md:pt-12">
				<h2 className="type-h3 m-0 min-w-0 truncate text-ink">Notifications</h2>
				<Button
					aria-label="Close notifications"
					className="h-10 w-10 text-ink-subtle hover:bg-surface hover:text-ink md:hidden"
					onClick={onClose}
					size="icon"
					variant="ghost"
				>
					<X size={16} />
				</Button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
				{isLoading ? (
					<NotificationListSkeleton />
				) : isError ? (
					<div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
						<p className="type-small m-0 text-danger">Could not load notifications.</p>
						<Button onClick={() => void refetch()} variant="secondary">
							Retry
						</Button>
					</div>
				) : notifications.length === 0 ? (
					<div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
						<Inbox className="text-ink-subtle" size={18} />
						<p className="type-small m-0 text-ink-muted">You're all caught up.</p>
					</div>
				) : (
					<div>
						{notifications.map((notification, index) => (
							<Fragment key={notification.id}>
								<NotificationRow
									notification={notification}
									onDismiss={() => dismissNotification(notification.id)}
									onOpen={() => openNotification(notification)}
								/>
								{index < notifications.length - 1 && (
									<div aria-hidden className="h-px bg-(--line)" />
								)}
							</Fragment>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
