import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	type AgentToolApproval,
	agentToolApprovalActionResponseSchema,
	agentToolApprovalListResponseSchema,
	agentToolApprovalSchema,
	agentToolPermissionActionResponseSchema,
	apiErrorResponseSchema,
	brainSearchResponseSchema,
	type Connection,
	connectionDisconnectResponseSchema,
	connectionSchema,
	homeSectionResponseSchema,
	meResponseSchema,
	notificationDetailResponseSchema,
	notificationListResponseSchema,
	type PaginationResponse,
	paginationResponseSchema,
	type Reminder,
	reminderActionResponseSchema,
	reminderSchema,
	type Session,
	sessionSchema,
	threadDetailResponseSchema,
	threadListResponseSchema,
	threadStopResponseSchema,
	transcriptionRealtimeTokenResponseSchema,
} from "@unison/contracts";
import { z } from "zod";

import { WebApiClient, WebApiError } from "./api";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const PROFILE_ID = "00000000-0000-4000-8000-000000000002";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const SESSION_ID = "00000000-0000-4000-8000-000000000004";
const SESSION_ID_B = "00000000-0000-4000-8000-000000000005";
const APPROVAL_ID = "00000000-0000-4000-8000-000000000006";
const TOOL_CALL_ID = "00000000-0000-4000-8000-000000000007";
const REMINDER_ID = "00000000-0000-4000-8000-000000000008";
const NOTIFICATION_ID = "00000000-0000-4000-8000-000000000009";
const DOCUMENT_ID = "00000000-0000-4000-8000-00000000000a";
const ISO = "2026-06-09T10:00:00.000Z";

const PAGINATION: PaginationResponse = paginationResponseSchema.parse({
	hasMore: false,
	limit: 25,
	nextCursor: null,
});

const ME_FIXTURE = meResponseSchema.parse({
	auth: { profileId: PROFILE_ID, tenantId: TENANT_ID, userId: USER_ID },
	featureFlags: {
		capture: true,
		chat: true,
		connectors: true,
		notifications: true,
		rawAudioUpload: false,
	},
	profile: {
		avatarUrl: null,
		createdAt: ISO,
		displayName: "Raf",
		email: "raf@example.com",
		id: PROFILE_ID,
		updatedAt: ISO,
	},
	tenant: {
		createdAt: ISO,
		displayName: "Raf's Brain",
		id: TENANT_ID,
		isDefault: true,
		role: "owner",
		status: "active",
		updatedAt: ISO,
	},
});

function session(overrides: Partial<Session>): Session {
	return sessionSchema.parse({
		captureId: null,
		createdAt: ISO,
		id: SESSION_ID,
		lastMessageAt: null,
		metadata: {},
		origin: "user",
		status: "open",
		tenantId: TENANT_ID,
		title: "Session",
		type: "freeform",
		updatedAt: ISO,
		userId: USER_ID,
		...overrides,
	});
}

function approval(overrides: Partial<AgentToolApproval>): AgentToolApproval {
	return agentToolApprovalSchema.parse({
		createdAt: ISO,
		decidedAt: null,
		decisionNote: null,
		expiresAt: null,
		id: APPROVAL_ID,
		input: {},
		metadata: {},
		requestedReason: null,
		sessionId: SESSION_ID,
		status: "pending",
		tenantId: TENANT_ID,
		toolCallId: TOOL_CALL_ID,
		toolName: "connector.google.gmail.createDraft",
		updatedAt: ISO,
		userId: USER_ID,
		...overrides,
	});
}

function reminder(overrides: Partial<Reminder>): Reminder {
	return reminderSchema.parse({
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
	});
}

const CONNECTION_FIXTURE: Connection = connectionSchema.parse({
	connectedAt: null,
	connectorAccountId: null,
	displayName: null,
	email: null,
	health: {
		detail: null,
		embeddingBacklog: 0,
		extractionBacklog: 0,
		failedJobs: 0,
		label: "Not connected",
		lastFailure: null,
		lastFailureAt: null,
		lastSourceEventAt: null,
		pendingJobs: 0,
		processedSourceEvents: 0,
		runningJobs: 0,
		state: "not_connected",
	},
	lastSyncAt: null,
	metadata: {},
	provider: "google",
	readOnly: false,
	scopes: [],
	status: "not_connected",
	supportsConnect: true,
});

const NOTIFICATION_LIST_FIXTURE = notificationListResponseSchema.parse({
	notifications: [
		{
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
			target: { kind: "session", sessionId: SESSION_ID },
			tenantId: TENANT_ID,
			title: "Meeting soon",
			updatedAt: ISO,
			urgency: "normal",
			userId: USER_ID,
		},
	],
	pagination: PAGINATION,
});

type RecordedRequest = {
	body: string | null;
	headers: Record<string, string>;
	method: string;
	url: string;
};

let recordedRequests: RecordedRequest[] = [];
let originalFetch: typeof fetch;

function stubFetch(...responses: Response[]) {
	globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
		recordedRequests.push({
			body: typeof init?.body === "string" ? init.body : null,
			headers: Object.fromEntries(new Headers(init?.headers).entries()),
			method: init?.method ?? "GET",
			url: String(input),
		});
		const response = responses.shift();
		if (!response) {
			throw new Error("Unexpected fetch call.");
		}
		return response;
	}) as unknown as typeof fetch;
}

function createClient(input?: {
	apiBaseUrl?: string;
	getToken?: () => string | null | Promise<string | null>;
	requestTimeoutMs?: number;
	token?: string | null;
}) {
	return new WebApiClient({
		apiBaseUrl: input?.apiBaseUrl ?? "https://api.test/",
		getToken: input?.getToken ?? (() => (input?.token === undefined ? "token-123" : input.token)),
		requestTimeoutMs: input?.requestTimeoutMs,
	});
}

function lastRequest(): RecordedRequest {
	const request = recordedRequests.at(-1);
	if (!request) {
		throw new Error("Expected a recorded fetch request.");
	}
	return request;
}

async function expectWebApiError(
	promise: Promise<unknown>,
	expected: { message: string; status: number },
) {
	let caught: unknown;
	try {
		await promise;
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(WebApiError);
	const apiError = caught as WebApiError;
	expect(apiError.message).toBe(expected.message);
	expect(apiError.status).toBe(expected.status);
}

beforeEach(() => {
	originalFetch = globalThis.fetch;
	recordedRequests = [];
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("WebApiClient request construction", () => {
	it("sends GET with bearer auth and trims the base URL trailing slash", async () => {
		stubFetch(Response.json(ME_FIXTURE));

		const me = await createClient().getMe();

		expect(me).toEqual(ME_FIXTURE);
		const request = lastRequest();
		expect(request.url).toBe("https://api.test/v1/me");
		expect(request.method).toBe("GET");
		expect(request.headers.authorization).toBe("Bearer token-123");
		expect(request.headers["content-type"]).toBe("application/json");
		expect(request.body).toBeNull();
	});

	it("interpolates path params for home sections", async () => {
		const fixture = homeSectionResponseSchema.parse({
			section: {
				id: "reminders",
				items: [],
				nextCursor: null,
				title: "Reminders",
				totalCount: 0,
				updatedAt: null,
			},
		});
		stubFetch(Response.json(fixture));

		const response = await createClient().getHomeSection("reminders");

		expect(response).toEqual(fixture);
		expect(lastRequest().url).toBe("https://api.test/v1/home/sections/reminders");
	});

	it("exposes the bearer token for direct storage uploads", async () => {
		stubFetch();

		const token = await createClient().getAccessToken();

		expect(token).toBe("token-123");
		expect(recordedRequests).toHaveLength(0);
	});

	it("mints realtime transcription tokens with POST", async () => {
		const fixture = transcriptionRealtimeTokenResponseSchema.parse({
			audioFormat: "pcm_16000",
			expiresAt: ISO,
			modelId: "scribe_v2_realtime",
			provider: "elevenlabs",
			token: "scribe-token",
			websocketUrl: "wss://api.elevenlabs.io/v1/speech-to-text/realtime",
		});
		stubFetch(Response.json(fixture));

		const response = await createClient().getRealtimeTranscriptionToken();

		expect(response).toEqual(fixture);
		const request = lastRequest();
		expect(request.url).toBe("https://api.test/v1/transcription/realtime-token");
		expect(request.method).toBe("POST");
		expect(request.body).toBeNull();
	});

	it("builds encoded query params for brain search", async () => {
		const fixture = brainSearchResponseSchema.parse({
			limit: 5,
			q: "vector db?",
			results: [
				{
					bodyPreview: "Postgres pgvector notes.",
					embeddingScore: null,
					id: SESSION_ID,
					kind: "note",
					path: "notes/vector-db.md",
					score: 0.62,
					sourceKind: null,
					sourceRef: null,
					textScore: 0.4,
					title: "Vector DB",
					tldr: null,
					updatedAt: ISO,
				},
			],
		});
		stubFetch(Response.json(fixture));

		const response = await createClient().searchBrain({ limit: 5, q: "vector db?" });

		expect(response).toEqual(fixture);
		expect(lastRequest().url).toBe("https://api.test/v1/brain/search?q=vector+db%3F&limit=5");
	});

	it("requests notifications without a status filter (backend ignores one)", async () => {
		stubFetch(Response.json(NOTIFICATION_LIST_FIXTURE));
		const client = createClient();

		await client.listNotifications();

		expect(recordedRequests.map((request) => request.url)).toEqual([
			"https://api.test/v1/notifications",
		]);
	});

	it("requests a single notification detail", async () => {
		const fixture = notificationDetailResponseSchema.parse({
			deliveries: [],
			notification: NOTIFICATION_LIST_FIXTURE.notifications[0],
			target: { kind: "session", sessionId: SESSION_ID },
		});
		stubFetch(Response.json(fixture));

		const response = await createClient().getNotification(NOTIFICATION_ID);

		expect(response).toEqual(fixture);
		expect(lastRequest().url).toBe(`https://api.test/v1/notifications/${NOTIFICATION_ID}`);
	});

	it("scopes pending approvals to a session and unwraps the list", async () => {
		const pending = approval({});
		stubFetch(Response.json(agentToolApprovalListResponseSchema.parse({ approvals: [pending] })));

		const approvals = await createClient().listPendingApprovals(SESSION_ID);

		expect(approvals).toEqual([pending]);
		expect(lastRequest().url).toBe(
			`https://api.test/v1/agent/tool-approvals?status=pending&sessionId=${SESSION_ID}`,
		);
	});

	it("posts a JSON body when deciding an approval", async () => {
		const decided = approval({ decidedAt: ISO, status: "approved" });
		stubFetch(Response.json(agentToolApprovalActionResponseSchema.parse({ approval: decided })));

		const response = await createClient().decideApproval(APPROVAL_ID, { decision: "approve" });

		expect(response.approval).toEqual(decided);
		const request = lastRequest();
		expect(request.url).toBe(`https://api.test/v1/agent/tool-approvals/${APPROVAL_ID}`);
		expect(request.method).toBe("POST");
		expect(JSON.parse(request.body ?? "")).toEqual({ decision: "approve" });
	});

	it("creates threads with POST and serializes the request body", async () => {
		const fixture = threadDetailResponseSchema.parse({ thread: session({ title: "New chat" }) });
		stubFetch(Response.json(fixture));

		const response = await createClient().createThread({
			metadata: {},
			title: "New chat",
			type: "freeform",
		});

		expect(response).toEqual(fixture);
		const request = lastRequest();
		expect(request.url).toBe("https://api.test/v1/threads");
		expect(request.method).toBe("POST");
		expect(JSON.parse(request.body ?? "")).toEqual({
			metadata: {},
			title: "New chat",
			type: "freeform",
		});
	});

	it("sorts the thread list by most recent activity", async () => {
		const stale = session({
			id: SESSION_ID,
			lastMessageAt: "2026-06-09T10:00:00.000Z",
			title: "Stale",
		});
		const fresh = session({
			id: SESSION_ID_B,
			lastMessageAt: null,
			title: "Fresh",
			updatedAt: "2026-06-09T11:00:00.000Z",
		});
		stubFetch(
			Response.json(
				threadListResponseSchema.parse({
					pagination: PAGINATION,
					threads: [stale, fresh],
				}),
			),
		);

		const response = await createClient().listThreads();

		expect(response.threads.map((thread) => thread.title)).toEqual(["Fresh", "Stale"]);
	});

	it("uses PUT for tool permission updates", async () => {
		const fixture = agentToolPermissionActionResponseSchema.parse({
			permission: {
				createdAt: ISO,
				id: APPROVAL_ID,
				metadata: {},
				permission: "always_allow",
				tenantId: TENANT_ID,
				toolName: "connector.google.gmail.createDraft",
				updatedAt: ISO,
				userId: USER_ID,
			},
		});
		stubFetch(Response.json(fixture));

		const response = await createClient().updateToolPermission(
			"connector.google.gmail.createDraft",
			{ permission: "always_allow" },
		);

		expect(response).toEqual(fixture);
		const request = lastRequest();
		expect(request.url).toBe(
			"https://api.test/v1/agent/tool-permissions/connector.google.gmail.createDraft",
		);
		expect(request.method).toBe("PUT");
		expect(JSON.parse(request.body ?? "")).toEqual({ permission: "always_allow" });
	});

	it("uses DELETE to disconnect a provider", async () => {
		const fixture = connectionDisconnectResponseSchema.parse({
			connection: CONNECTION_FIXTURE,
			disconnected: true,
		});
		stubFetch(Response.json(fixture));

		const response = await createClient().disconnectProvider("google");

		expect(response).toEqual(fixture);
		const request = lastRequest();
		expect(request.url).toBe("https://api.test/v1/connections/google");
		expect(request.method).toBe("DELETE");
	});

	it("uses DELETE to remove a document", async () => {
		stubFetch(Response.json({ deleted: true, documentId: DOCUMENT_ID }));

		await createClient().deleteDocument(DOCUMENT_ID);

		const request = lastRequest();
		expect(request.url).toBe(`https://api.test/v1/documents/${DOCUMENT_ID}`);
		expect(request.method).toBe("DELETE");
		expect(request.body).toBeNull();
	});

	it("snoozes a reminder with a POST body and unwrapped schema validation", async () => {
		const snoozed = reminder({ snoozedUntil: "2026-06-09T11:00:00.000Z", status: "snoozed" });
		stubFetch(Response.json(reminderActionResponseSchema.parse({ reminder: snoozed })));

		const response = await createClient().snoozeReminder(REMINDER_ID, {
			snoozedUntil: "2026-06-09T11:00:00.000Z",
		});

		expect(response.reminder).toEqual(snoozed);
		const request = lastRequest();
		expect(request.url).toBe(`https://api.test/v1/reminders/${REMINDER_ID}/snooze`);
		expect(request.method).toBe("POST");
		expect(JSON.parse(request.body ?? "")).toEqual({
			snoozedUntil: "2026-06-09T11:00:00.000Z",
		});
	});

	it("unwraps the stopped flag and scopes stop requests to a session", async () => {
		stubFetch(
			Response.json(threadStopResponseSchema.parse({ stopped: true })),
			Response.json(threadStopResponseSchema.parse({ stopped: false })),
		);
		const client = createClient();

		const stoppedWithSession = await client.stopThreadGeneration({
			sessionId: SESSION_ID,
			threadId: SESSION_ID_B,
		});
		const stoppedWithoutSession = await client.stopThreadGeneration({ threadId: SESSION_ID_B });

		expect(stoppedWithSession).toBe(true);
		expect(stoppedWithoutSession).toBe(false);
		expect(recordedRequests.map((request) => JSON.parse(request.body ?? ""))).toEqual([
			{ sessionId: SESSION_ID },
			{},
		]);
		expect(lastRequest().url).toBe(`https://api.test/v1/threads/${SESSION_ID_B}/stop`);
	});
});

describe("WebApiClient error handling", () => {
	it("surfaces the server error envelope as a typed WebApiError", async () => {
		const envelope = apiErrorResponseSchema.parse({
			error: { code: "forbidden", message: "Tool is not allowed." },
		});
		stubFetch(Response.json(envelope, { status: 403 }));

		await expectWebApiError(createClient().getMe(), {
			message: "Tool is not allowed.",
			status: 403,
		});
	});

	it("falls back to a generic message for non-JSON error bodies", async () => {
		stubFetch(new Response("upstream exploded", { status: 502 }));

		await expectWebApiError(createClient().getMe(), {
			message: "Request failed with status 502.",
			status: 502,
		});
	});

	it("rejects schema-invalid success payloads with a validation error", async () => {
		stubFetch(Response.json({ unexpected: true }));

		let caught: unknown;
		try {
			await createClient().getMe();
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(z.ZodError);
	});

	it("requires a bearer token before issuing any request", async () => {
		stubFetch();

		await expectWebApiError(createClient({ token: null }).getMe(), {
			message: "A bearer token is required.",
			status: 401,
		});
		expect(recordedRequests).toHaveLength(0);
	});

	it("fails fast when the API base URL is not configured", async () => {
		stubFetch();

		await expectWebApiError(createClient({ apiBaseUrl: "" }).getMe(), {
			message: "NEXT_PUBLIC_API_BASE_URL is not configured.",
			status: 400,
		});
		expect(recordedRequests).toHaveLength(0);
	});

	it("times out JSON requests that never settle", async () => {
		globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new DOMException("Aborted", "AbortError"));
				});
			})) as unknown as typeof fetch;

		await expectWebApiError(createClient({ requestTimeoutMs: 1 }).getMe(), {
			message: "Request timed out.",
			status: 408,
		});
	});

	it("times out JSON body parsing that never settles", async () => {
		globalThis.fetch = (async () =>
			({
				json: () => new Promise<unknown>(() => {}),
				ok: true,
				status: 200,
			}) as Response) as unknown as typeof fetch;

		await expectWebApiError(createClient({ requestTimeoutMs: 1 }).getMe(), {
			message: "Request timed out.",
			status: 408,
		});
	});

	it("times out token lookup that never settles", async () => {
		stubFetch();

		await expectWebApiError(
			createClient({
				getToken: () => new Promise<string | null>(() => {}),
				requestTimeoutMs: 1,
			}).getMe(),
			{
				message: "Request timed out.",
				status: 408,
			},
		);
		expect(recordedRequests).toHaveLength(0);
	});
});
