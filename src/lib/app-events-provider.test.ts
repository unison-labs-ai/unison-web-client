import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type {
	AppEvent,
	NotificationIntent,
	NotificationListResponse,
	PaginationResponse,
	Reminder,
	ReminderListResponse,
	Session,
	SessionArtifact,
	ThreadDetailResponse,
	ThreadListResponse,
} from "@unison/contracts";

import {
	applyLiveEvent,
	invalidateForAppEvent,
	sessionIdFor,
	updateThreadCaches,
} from "./app-events-provider";
import { threadMessagesQueryKey, threadQueryKey } from "./thread-cache";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_ID = "00000000-0000-4000-8000-000000000002";
const THREAD_ID = "00000000-0000-4000-8000-000000000003";
const THREAD_ID_B = "00000000-0000-4000-8000-000000000004";
const NOTIFICATION_ID = "00000000-0000-4000-8000-000000000005";
const REMINDER_ID = "00000000-0000-4000-8000-000000000006";
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000007";
const ISO = "2026-06-20T12:22:08.000Z";

const PAGINATION: PaginationResponse = {
	hasMore: false,
	limit: 25,
	nextCursor: null,
};

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function session(overrides: Partial<Session> = {}): Session {
	return {
		captureId: null,
		createdAt: ISO,
		id: THREAD_ID,
		lastMessageAt: null,
		metadata: {},
		origin: "user",
		permissionMode: "human_in_the_loop",
		status: "open",
		tenantId: TENANT_ID,
		title: "Session",
		type: "freeform",
		updatedAt: ISO,
		userId: USER_ID,
		...overrides,
	};
}

function notification(overrides: Partial<NotificationIntent> = {}): NotificationIntent {
	return {
		body: "Design review starts in 10 minutes.",
		category: "ai",
		createdAt: ISO,
		decisionReason: null,
		dedupeKey: null,
		id: NOTIFICATION_ID,
		originAgentRunId: null,
		originSessionId: null,
		originToolCallId: null,
		payload: {},
		sourceEventId: null,
		status: "pending",
		target: { kind: "session", sessionId: THREAD_ID },
		tenantId: TENANT_ID,
		title: "Meeting soon",
		updatedAt: ISO,
		urgency: "normal",
		userId: USER_ID,
		...overrides,
	};
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
	return {
		body: null,
		captureId: null,
		createdAt: ISO,
		dueAt: ISO,
		id: REMINDER_ID,
		metadata: {},
		snoozedUntil: null,
		sourceEventId: null,
		status: "scheduled",
		tenantId: TENANT_ID,
		timezone: null,
		title: "Pay rent",
		updatedAt: ISO,
		userId: USER_ID,
		...overrides,
	};
}

function artifact(overrides: Partial<SessionArtifact> = {}): SessionArtifact {
	return {
		agentRunId: null,
		artifactKind: "report",
		createdAt: ISO,
		id: ARTIFACT_ID,
		metadata: {},
		payload: {},
		sessionId: THREAD_ID,
		status: "active",
		tenantId: TENANT_ID,
		title: "Report",
		toolCallId: null,
		updatedAt: ISO,
		userId: USER_ID,
		...overrides,
	};
}

function event(overrides: Partial<AppEvent>): AppEvent {
	return {
		aggregateId: THREAD_ID,
		aggregateSeq: 1,
		aggregateType: "thread",
		createdAt: ISO,
		payload: {},
		seq: 1,
		type: "thread.updated",
		...overrides,
	};
}

function expectInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]) {
	expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
}

describe("web app-events cache bridge", () => {
	it("uses aggregate and payload thread ids consistently", () => {
		expect(sessionIdFor(event({ aggregateId: THREAD_ID, aggregateType: "thread" }))).toBe(
			THREAD_ID,
		);
		expect(
			sessionIdFor(
				event({
					aggregateId: NOTIFICATION_ID,
					aggregateType: "notification",
					payload: { threadId: THREAD_ID_B },
				}),
			),
		).toBe(THREAD_ID_B);
	});

	it("folds live-session start and settled events without changing unrelated references", () => {
		const initial = new Set<string>();
		const started = applyLiveEvent(initial, event({ type: "run.started" }));
		expect(started.has(THREAD_ID)).toBe(true);
		expect(applyLiveEvent(started, event({ type: "run.started" }))).toBe(started);

		const completed = applyLiveEvent(started, event({ type: "run.completed" }));
		expect(completed.has(THREAD_ID)).toBe(false);
		expect(applyLiveEvent(completed, event({ type: "message.delta" }))).toBe(completed);
	});

	it("writes thread.updated payloads into detail and list caches immediately", () => {
		const queryClient = createQueryClient();
		const previous = session({ title: "Hey, what do you know about me and what can you do?" });
		const generated = session({
			title: "What you know about me",
			updatedAt: "2026-06-20T12:22:09.000Z",
		});
		queryClient.setQueryData<ThreadDetailResponse>(threadQueryKey(THREAD_ID), {
			thread: previous,
		});
		queryClient.setQueryData<ThreadListResponse>(["threads"], {
			pagination: PAGINATION,
			threads: [session({ id: THREAD_ID_B, title: "Older" }), previous],
		});

		updateThreadCaches(
			queryClient,
			event({
				payload: { thread: generated, threadId: THREAD_ID },
				type: "thread.updated",
			}),
		);

		expect(
			queryClient.getQueryData<ThreadDetailResponse>(threadQueryKey(THREAD_ID))?.thread.title,
		).toBe("What you know about me");
		expect(
			queryClient
				.getQueryData<ThreadListResponse>(["threads"])
				?.threads.find((thread) => thread.id === THREAD_ID)?.title,
		).toBe("What you know about me");
		expectInvalidated(queryClient, threadQueryKey(THREAD_ID));
		expectInvalidated(queryClient, ["threads"]);
	});

	it("invalidates attention and artifact surfaces from durable app events", () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData<NotificationListResponse>(["notifications"], {
			notifications: [notification({ title: "Old notification" })],
			pagination: PAGINATION,
		});
		queryClient.setQueryData<ReminderListResponse>(["reminders"], {
			pagination: PAGINATION,
			reminders: [reminder({ title: "Old reminder" })],
		});
		queryClient.setQueryData(["home-section", "attention"], { items: [] });
		queryClient.setQueryData(["artifact", ARTIFACT_ID], artifact({ title: "Old artifact" }));
		queryClient.setQueryData(["thread", THREAD_ID, "artifacts"], { artifacts: [] });

		invalidateForAppEvent(
			queryClient,
			event({
				aggregateId: NOTIFICATION_ID,
				aggregateType: "notification",
				payload: {
					notification: notification({ title: "Meeting soon" }),
					notificationId: NOTIFICATION_ID,
				},
				type: "notification.updated",
			}),
		);
		invalidateForAppEvent(
			queryClient,
			event({
				aggregateId: REMINDER_ID,
				aggregateType: "reminder",
				payload: { reminder: reminder({ title: "Pay rent" }), reminderId: REMINDER_ID },
				type: "reminder.updated",
			}),
		);
		invalidateForAppEvent(
			queryClient,
			event({
				aggregateId: ARTIFACT_ID,
				aggregateType: "artifact",
				payload: {
					artifact: artifact({ title: "Fresh report" }),
					artifactId: ARTIFACT_ID,
					threadId: THREAD_ID,
				},
				type: "artifact.created",
			}),
		);

		expect(
			queryClient.getQueryData<NotificationListResponse>(["notifications"])?.notifications[0]
				?.title,
		).toBe("Meeting soon");
		expect(queryClient.getQueryData<ReminderListResponse>(["reminders"])?.reminders[0]?.title).toBe(
			"Pay rent",
		);
		expect(queryClient.getQueryData<SessionArtifact>(["artifact", ARTIFACT_ID])?.title).toBe(
			"Fresh report",
		);
		expectInvalidated(queryClient, ["notifications"]);
		expectInvalidated(queryClient, ["reminders"]);
		expectInvalidated(queryClient, ["home-section", "attention"]);
		expectInvalidated(queryClient, ["thread", THREAD_ID, "artifacts"]);
	});

	it("refreshes approvals and thread snapshots on input requests and settled runs", () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(["approvals"], []);
		queryClient.setQueryData(["approvals", "pending"], []);
		queryClient.setQueryData(threadQueryKey(THREAD_ID), { thread: session() });
		queryClient.setQueryData(threadMessagesQueryKey(THREAD_ID), { messages: [] });

		invalidateForAppEvent(queryClient, event({ type: "input.requested" }));
		expectInvalidated(queryClient, ["approvals"]);
		expectInvalidated(queryClient, ["approvals", "pending"]);

		queryClient.setQueryData(["approvals", "pending"], []);
		invalidateForAppEvent(queryClient, event({ type: "run.completed" }));
		expectInvalidated(queryClient, ["approvals", "pending"]);
		expectInvalidated(queryClient, threadQueryKey(THREAD_ID));
		expectInvalidated(queryClient, threadMessagesQueryKey(THREAD_ID));
	});
});
