"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
	type AppEvent,
	type NotificationDetailResponse,
	type NotificationListResponse,
	notificationIntentSchema,
	type ReminderListResponse,
	reminderSchema,
	type Session,
	sessionArtifactSchema,
	sessionSchema,
	type ThreadDetailResponse,
	type ThreadListResponse,
} from "@unison/contracts";
import { usePathname } from "next/navigation";
import {
	createContext,
	type PropsWithChildren,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useApi } from "@/lib/api-context";
import { threadMessagesQueryKey, threadQueryKey } from "@/lib/thread-cache";

export type AppEventConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting";

type AppEventsContextValue = {
	events: AppEvent[];
	lastSeq: number;
	status: AppEventConnectionStatus;
};

const MAX_EVENTS = 500;
const HEARTBEAT_TIMEOUT_MS = 15_000;
const LIVE_EVENTS = new Set<AppEvent["type"]>(["turn.admitted", "run.started"]);
const SETTLED_EVENTS = new Set<AppEvent["type"]>(["run.completed", "run.failed"]);

const AppEventsContext = createContext<AppEventsContextValue | null>(null);
const ConnectionStatusContext = createContext<AppEventConnectionStatus | null>(null);
const LiveSessionsContext = createContext<ReadonlySet<string> | null>(null);

type UnknownRecord = Record<string, unknown>;

function recordValue(value: unknown): UnknownRecord {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as UnknownRecord)
		: {};
}

function stringValue(record: UnknownRecord, key: string): string | null {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

function lastThreadActivityAt(session: Session): string {
	return session.lastMessageAt ?? session.updatedAt ?? session.createdAt;
}

function sortThreads(threads: Session[]): Session[] {
	return [...threads].sort((left, right) =>
		lastThreadActivityAt(right).localeCompare(lastThreadActivityAt(left)),
	);
}

function updateThreadList(current: ThreadListResponse | undefined, thread: Session) {
	if (!current) {
		return current;
	}

	const existingIndex = current.threads.findIndex((item) => item.id === thread.id);
	const threads =
		existingIndex >= 0
			? current.threads.map((item) => (item.id === thread.id ? thread : item))
			: [thread, ...current.threads];

	return {
		...current,
		threads: sortThreads(threads),
	};
}

function updateNotificationList(
	current: NotificationListResponse | undefined,
	notification: NotificationListResponse["notifications"][number],
) {
	if (!current) {
		return current;
	}

	const existingIndex = current.notifications.findIndex((item) => item.id === notification.id);
	const notifications =
		existingIndex >= 0
			? current.notifications.map((item) => (item.id === notification.id ? notification : item))
			: [notification, ...current.notifications];

	return {
		...current,
		notifications: notifications.sort((left, right) =>
			right.createdAt.localeCompare(left.createdAt),
		),
	};
}

function updateReminderList(
	current: ReminderListResponse | undefined,
	reminder: ReminderListResponse["reminders"][number],
) {
	if (!current) {
		return current;
	}

	const existingIndex = current.reminders.findIndex((item) => item.id === reminder.id);
	const reminders =
		existingIndex >= 0
			? current.reminders.map((item) => (item.id === reminder.id ? reminder : item))
			: [reminder, ...current.reminders];

	return {
		...current,
		reminders: reminders.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
	};
}

export function sessionIdFor(event: AppEvent): string | null {
	if (event.aggregateType === "thread") {
		return event.aggregateId;
	}

	const payload = recordValue(event.payload);
	return stringValue(payload, "threadId") ?? stringValue(payload, "sessionId");
}

export function applyLiveEvent(current: ReadonlySet<string>, event: AppEvent): ReadonlySet<string> {
	const sessionId = sessionIdFor(event);

	if (!sessionId) {
		return current;
	}

	if (LIVE_EVENTS.has(event.type) && !current.has(sessionId)) {
		const next = new Set(current);
		next.add(sessionId);
		return next;
	}

	if (SETTLED_EVENTS.has(event.type) && current.has(sessionId)) {
		const next = new Set(current);
		next.delete(sessionId);
		return next;
	}

	return current;
}

export function updateThreadCaches(queryClient: QueryClient, event: AppEvent): void {
	if (event.type !== "thread.created" && event.type !== "thread.updated") {
		return;
	}

	const payload = recordValue(event.payload);
	const parsed = sessionSchema.safeParse(payload.thread);
	const threadId = parsed.success
		? parsed.data.id
		: (stringValue(payload, "threadId") ?? sessionIdFor(event));

	if (parsed.success) {
		const thread = parsed.data;
		queryClient.setQueryData<ThreadDetailResponse>(threadQueryKey(thread.id), { thread });
		queryClient.setQueryData<ThreadListResponse | undefined>(["threads"], (current) =>
			updateThreadList(current, thread),
		);
	}

	if (threadId) {
		void queryClient.invalidateQueries({ queryKey: threadQueryKey(threadId) });
	}

	void queryClient.invalidateQueries({ queryKey: ["threads"] });
}

function updateNotificationCaches(queryClient: QueryClient, event: AppEvent): void {
	const payload = recordValue(event.payload);
	const notificationId = stringValue(payload, "notificationId") ?? event.aggregateId;
	const parsed = notificationIntentSchema.safeParse(payload.notification);

	if (parsed.success) {
		const notification = parsed.data;
		queryClient.setQueryData<NotificationListResponse | undefined>(["notifications"], (current) =>
			updateNotificationList(current, notification),
		);
		queryClient.setQueryData<NotificationDetailResponse | undefined>(
			["notifications", notification.id],
			(current) =>
				current
					? {
							...current,
							notification,
							target: notification.target,
						}
					: current,
		);
	}

	void queryClient.invalidateQueries({ queryKey: ["notifications"] });
	if (notificationId) {
		void queryClient.invalidateQueries({ queryKey: ["notifications", notificationId] });
	}
	void queryClient.invalidateQueries({ queryKey: ["home-section"] });
}

function updateReminderCaches(queryClient: QueryClient, event: AppEvent): void {
	const payload = recordValue(event.payload);
	const reminderId = stringValue(payload, "reminderId") ?? event.aggregateId;
	const parsed = reminderSchema.safeParse(payload.reminder);

	if (parsed.success) {
		const reminder = parsed.data;
		queryClient.setQueryData<ReminderListResponse | undefined>(["reminders"], (current) =>
			updateReminderList(current, reminder),
		);
	}

	void queryClient.invalidateQueries({ queryKey: ["reminders"] });
	if (reminderId) {
		void queryClient.invalidateQueries({ queryKey: ["reminders", reminderId] });
	}
	void queryClient.invalidateQueries({ queryKey: ["home-section"] });
}

function updateArtifactCaches(queryClient: QueryClient, event: AppEvent): void {
	const payload = recordValue(event.payload);
	const parsed = sessionArtifactSchema.safeParse(payload.artifact);
	const artifactId = parsed.success
		? parsed.data.id
		: (stringValue(payload, "artifactId") ?? event.aggregateId);
	const threadId = parsed.success ? parsed.data.sessionId : stringValue(payload, "threadId");

	if (parsed.success) {
		queryClient.setQueryData(["artifact", parsed.data.id], parsed.data);
	}

	if (artifactId) {
		void queryClient.invalidateQueries({ queryKey: ["artifact", artifactId] });
	}
	if (threadId) {
		void queryClient.invalidateQueries({ queryKey: ["thread", threadId, "artifacts"] });
		void queryClient.invalidateQueries({ queryKey: threadQueryKey(threadId) });
	}
}

function completedToolAffectsHome(event: AppEvent): boolean {
	if (event.type !== "tool.completed") {
		return false;
	}

	const toolName = recordValue(event.payload).toolName;
	return (
		toolName === "notification.create" ||
		toolName === "notification.dismiss" ||
		toolName === "notification.snooze" ||
		toolName === "reminder.create" ||
		toolName === "reminder.update" ||
		toolName === "reminder.complete"
	);
}

export function invalidateForAppEvent(queryClient: QueryClient, event: AppEvent): void {
	updateThreadCaches(queryClient, event);

	const threadId = sessionIdFor(event);

	if (event.type === "notification.updated") {
		updateNotificationCaches(queryClient, event);
		return;
	}

	if (event.type === "reminder.updated") {
		updateReminderCaches(queryClient, event);
		return;
	}

	if (event.type === "artifact.created") {
		updateArtifactCaches(queryClient, event);
		void queryClient.invalidateQueries({ queryKey: ["home-section"] });
		return;
	}

	if (event.type === "input.requested") {
		void queryClient.invalidateQueries({ queryKey: ["approvals"] });
		void queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
		return;
	}

	if (event.type === "thread.created" || event.type === "thread.updated") {
		void queryClient.invalidateQueries({ queryKey: ["home-section"] });
		return;
	}

	if (event.type === "turn.admitted" || event.type === "run.started") {
		void queryClient.invalidateQueries({ queryKey: ["threads"] });
		return;
	}

	if (event.type === "run.completed" || event.type === "run.failed") {
		void queryClient.invalidateQueries({ queryKey: ["threads"] });
		void queryClient.invalidateQueries({ queryKey: ["approvals"] });
		void queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
		void queryClient.invalidateQueries({ queryKey: ["home-section"] });
		if (threadId) {
			void queryClient.invalidateQueries({ queryKey: threadQueryKey(threadId) });
			void queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey(threadId) });
		}
		return;
	}

	if (completedToolAffectsHome(event)) {
		void queryClient.invalidateQueries({ queryKey: ["home-section"] });
		void queryClient.invalidateQueries({ queryKey: ["notifications"] });
		void queryClient.invalidateQueries({ queryKey: ["reminders"] });
	}
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

function isAuthPath(pathname: string | null): boolean {
	return pathname === "/sign-in" || pathname?.startsWith("/sign-in/") === true;
}

export function AppEventsProvider({ children }: PropsWithChildren) {
	const api = useApi();
	const queryClient = useQueryClient();
	const pathname = usePathname();
	const [events, setEvents] = useState<AppEvent[]>([]);
	const [lastSeq, setLastSeq] = useState(0);
	const [status, setStatus] = useState<AppEventConnectionStatus>("idle");
	const [liveSessions, setLiveSessions] = useState<ReadonlySet<string>>(() => new Set());
	const lastSeqRef = useRef(0);
	const skipStream = isAuthPath(pathname);

	useEffect(() => {
		if (skipStream) {
			lastSeqRef.current = 0;
			setEvents([]);
			setLastSeq(0);
			setStatus("idle");
			setLiveSessions(new Set());
			return;
		}

		let cancelled = false;
		let streamAbort: AbortController | null = null;
		const lifecycleAbort = new AbortController();

		async function connectLoop() {
			let retryMs = 500;

			while (!cancelled && !lifecycleAbort.signal.aborted) {
				streamAbort = new AbortController();
				let watchdog: ReturnType<typeof setTimeout> | null = null;
				const resetWatchdog = () => {
					if (watchdog) {
						clearTimeout(watchdog);
					}

					watchdog = setTimeout(() => {
						streamAbort?.abort();
					}, HEARTBEAT_TIMEOUT_MS);
				};

				try {
					setStatus(lastSeqRef.current > 0 ? "reconnecting" : "connecting");
					resetWatchdog();
					await api.streamAppEvents({
						after: lastSeqRef.current,
						onActivity: resetWatchdog,
						onEvent(event) {
							if (event.seq <= lastSeqRef.current) {
								return;
							}

							lastSeqRef.current = event.seq;
							setLastSeq(event.seq);
							setStatus("connected");
							setEvents((current) => {
								const next = [...current, event];
								return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
							});
							setLiveSessions((current) => applyLiveEvent(current, event));
							invalidateForAppEvent(queryClient, event);
						},
						signal: streamAbort.signal,
					});
					retryMs = 500;
				} catch {
					if (!cancelled && !lifecycleAbort.signal.aborted) {
						setStatus("reconnecting");
					}
				} finally {
					if (watchdog) {
						clearTimeout(watchdog);
					}
				}

				if (!cancelled && !lifecycleAbort.signal.aborted) {
					await sleep(retryMs, lifecycleAbort.signal);
					retryMs = Math.min(retryMs * 2, 5000);
				}
			}
		}

		void connectLoop();

		return () => {
			cancelled = true;
			lifecycleAbort.abort();
			streamAbort?.abort();
		};
	}, [api, queryClient, skipStream]);

	const value = useMemo(
		() => ({
			events,
			lastSeq,
			status,
		}),
		[events, lastSeq, status],
	);

	return (
		<AppEventsContext.Provider value={value}>
			<ConnectionStatusContext.Provider value={status}>
				<LiveSessionsContext.Provider value={liveSessions}>{children}</LiveSessionsContext.Provider>
			</ConnectionStatusContext.Provider>
		</AppEventsContext.Provider>
	);
}

export function useAppEvents(): AppEventsContextValue {
	const value = useContext(AppEventsContext);

	if (value === null) {
		throw new Error("useAppEvents must be used inside AppEventsProvider.");
	}

	return value;
}

export function useAppEventConnectionStatus(): AppEventConnectionStatus {
	const status = useContext(ConnectionStatusContext);

	if (status === null) {
		throw new Error("useAppEventConnectionStatus must be used inside AppEventsProvider.");
	}

	return status;
}

export function useLiveSessions(): ReadonlySet<string> {
	const liveSessions = useContext(LiveSessionsContext);

	if (liveSessions === null) {
		throw new Error("useLiveSessions must be used inside AppEventsProvider.");
	}

	return liveSessions;
}
