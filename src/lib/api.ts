import {
	type AccountDeleteResponse,
	type AccountRequestResponse,
	type AgentAccountPolicyResponse,
	type AgentAccountPolicyUpdateRequest,
	type AgentToolApproval,
	type AgentToolApprovalActionResponse,
	type AgentToolApprovalDecisionRequest,
	type AgentToolApprovalListResponse,
	type AgentToolApprovalStatus,
	type AgentToolPermissionActionResponse,
	type AgentToolPermissionListResponse,
	type AgentToolPermissionUpdateRequest,
	type AppEvent,
	type ArtifactUpdateRequest,
	type AutomationAccountScopeUpdateRequest,
	type AutomationActionResponse,
	type AutomationCompositionRequest,
	type AutomationCompositionResponse,
	type AutomationCreateRequest,
	type AutomationDetailResponse,
	type AutomationExportResponse,
	type AutomationImportRequest,
	type AutomationInvocation,
	type AutomationInvocationListResponse,
	type AutomationMemoryResponse,
	type AutomationRunDetailResponse,
	type AutomationRunNowResponse,
	type AutomationSettingsUpdateRequest,
	type AutomationTemplate,
	type AutomationToolsUpdateRequest,
	type AutomationTriggerCreateRequest,
	type AutomationTriggerUpdateRequest,
	type AutomationUpdateRequest,
	type AutomationWebhookActionResponse,
	type AutomationWebhookUpdateRequest,
	type AutomationWithRelations,
	accountDeleteResponseSchema,
	accountRequestResponseSchema,
	agentAccountPolicyResponseSchema,
	agentToolApprovalActionResponseSchema,
	agentToolApprovalListResponseSchema,
	agentToolPermissionActionResponseSchema,
	agentToolPermissionListResponseSchema,
	apiErrorResponseSchema,
	appEventSchema,
	automationActionResponseSchema,
	automationCompositionResponseSchema,
	automationDetailResponseSchema,
	automationExportResponseSchema,
	automationInvocationListResponseSchema,
	automationListResponseSchema,
	automationMemoryResponseSchema,
	automationRunDetailResponseSchema,
	automationRunNowResponseSchema,
	automationTemplateListResponseSchema,
	automationWebhookActionResponseSchema,
	type BrainSearchRequest,
	type BrainSearchResponse,
	brainSearchResponseSchema,
	type CaptureDetailResponse,
	type CaptureListResponse,
	type CaptureTranscriptResponse,
	type CliTokenResponse,
	type Connection,
	type ConnectionConnectResponse,
	type ConnectionDisconnectResponse,
	type ConnectionProvider,
	type ConnectorMessage,
	captureDetailResponseSchema,
	captureListResponseSchema,
	captureTranscriptResponseSchema,
	cliTokenResponseSchema,
	connectionConnectResponseSchema,
	connectionDisconnectResponseSchema,
	connectionListResponseSchema,
	connectorMessageSchema,
	type DocumentCreateRequest,
	type DocumentExportFormat,
	type DocumentGoogleDriveExportResponse,
	type DocumentListItem,
	type DocumentRecord,
	type DocumentUpdateRequest,
	documentDeleteResponseSchema,
	documentDetailResponseSchema,
	documentGoogleDriveExportResponseSchema,
	documentListResponseSchema,
	type EvalBlessRunResponse,
	type EvalRunDetailResponse,
	type EvalRunEventWire,
	type EvalRunListResponse,
	type EvalRunStatusWire,
	type EvalRunWire,
	type EvalSessionOverlayResponse,
	type EvalSuiteIdWire,
	evalBlessRunResponseSchema,
	evalRunActionResponseSchema,
	evalRunDetailResponseSchema,
	evalRunEventWireSchema,
	evalRunListResponseSchema,
	evalSessionOverlayResponseSchema,
	type HomeResponse,
	type HomeSectionId,
	type HomeSectionResponse,
	homeResponseSchema,
	homeSectionResponseSchema,
	type MeResponse,
	meResponseSchema,
	type NotificationActionResponse,
	type NotificationDetailResponse,
	type NotificationListResponse,
	type NotificationPreference,
	type NotificationPreferenceListResponse,
	type NotificationPreferenceUpdateRequest,
	type NotificationSnoozeRequest,
	notificationActionResponseSchema,
	notificationDetailResponseSchema,
	notificationListResponseSchema,
	notificationPreferenceListResponseSchema,
	notificationPreferenceSchema,
	type PrivacySettings,
	type PrivacySettingsUpdateRequest,
	privacySettingsSchema,
	type ReminderActionResponse,
	type ReminderListResponse,
	type ReminderSnoozeRequest,
	reminderActionResponseSchema,
	reminderListResponseSchema,
	type Session,
	type SessionArtifact,
	type SessionArtifactDetailResponse,
	type SessionArtifactListResponse,
	type SessionArtifactSendResponse,
	type SessionSourceListResponse,
	type SkillCreateRequest,
	type SkillListItem,
	type SkillRecord,
	type SkillUpdateRequest,
	sessionArtifactDetailResponseSchema,
	sessionArtifactListResponseSchema,
	sessionArtifactSendResponseSchema,
	sessionSourceListResponseSchema,
	skillDeleteResponseSchema,
	skillDetailResponseSchema,
	skillListResponseSchema,
	type ThreadCreateRequest,
	type ThreadDetailResponse,
	type ThreadEventsResponse,
	type ThreadListResponse,
	type ThreadMessageCreateRequest,
	type ThreadMessageListResponse,
	type ThreadMessageSendResponse,
	type ThreadMessageStreamEvent,
	type ThreadPermissionModeUpdateRequest,
	type ToolCatalogResponse,
	type TranscriptionRealtimeTokenResponse,
	threadDetailResponseSchema,
	threadEventsResponseSchema,
	threadListResponseSchema,
	threadMessageListResponseSchema,
	threadMessageSendResponseSchema,
	threadMessageStreamEventSchema,
	threadStopResponseSchema,
	toolCatalogResponseSchema,
	transcriptionRealtimeTokenResponseSchema,
	type WebSourceListResponse,
	webSourceListResponseSchema,
} from "@unison/contracts";
import type { z } from "zod";

import { readSseStream, SseRequestError } from "./sse";

type RequestOptions = {
	body?: unknown;
	method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

type StreamThreadOptions = {
	fromEventIndex?: number;
	onActivity?: () => void;
	onEvent: (event: ThreadMessageStreamEvent) => void;
	sessionId: string;
	signal?: AbortSignal;
	threadId: string;
};

type StreamAppEventsOptions = {
	after?: number;
	onActivity?: () => void;
	onEvent: (event: AppEvent) => void;
	signal?: AbortSignal;
};

type StreamEvalRunEventsOptions = {
	fromEventIndex?: number;
	onActivity?: () => void;
	onEvent: (event: EvalRunEventWire) => void;
	runId: string;
	signal?: AbortSignal;
};

export type EvalRunListFilters = {
	cursor?: string;
	/** ISO date-time lower bound (inclusive). */
	from?: string;
	limit?: number;
	model?: string;
	/** Multiple statuses are sent comma-joined on the single `status` param. */
	status?: EvalRunStatusWire[];
	suite?: EvalSuiteIdWire;
	/** ISO date-time upper bound (inclusive). */
	to?: string;
};

export class WebApiError extends Error {
	readonly status: number;
	readonly code: string | null;

	constructor(message: string, status: number, code: string | null = null) {
		super(message);
		this.name = "WebApiError";
		this.status = status;
		this.code = code;
	}
}

export class WebApiClient {
	readonly apiBaseUrl: string;
	readonly getToken: () => string | null | Promise<string | null>;
	readonly onUnauthorized?: () => void;
	readonly requestTimeoutMs: number;

	constructor(input: {
		apiBaseUrl: string;
		getToken: () => string | null | Promise<string | null>;
		onUnauthorized?: () => void;
		requestTimeoutMs?: number;
	}) {
		this.apiBaseUrl = input.apiBaseUrl.replace(/\/+$/, "");
		this.getToken = input.getToken;
		this.onUnauthorized = input.onUnauthorized;
		this.requestTimeoutMs = input.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
	}

	async getMe(): Promise<MeResponse> {
		return this.requestJson("/v1/me", meResponseSchema);
	}

	/** Mint a fresh, revocable CLI key for this user's brain ("connect to terminal"). */
	async mintCliToken(): Promise<CliTokenResponse> {
		return this.requestJson("/v1/account/cli-token", cliTokenResponseSchema, { method: "POST" });
	}

	async getHome(): Promise<HomeResponse> {
		return this.requestJson("/v1/home", homeResponseSchema);
	}

	async getHomeSection(sectionId: HomeSectionId): Promise<HomeSectionResponse> {
		return this.requestJson(`/v1/home/sections/${sectionId}`, homeSectionResponseSchema);
	}

	async getAccessToken(): Promise<string> {
		const token = await this.getToken();

		if (!token) {
			throw new WebApiError("A bearer token is required.", 401);
		}

		return token;
	}

	async getRealtimeTranscriptionToken(): Promise<TranscriptionRealtimeTokenResponse> {
		return this.requestJson(
			"/v1/transcription/realtime-token",
			transcriptionRealtimeTokenResponseSchema,
			{
				method: "POST",
			},
		);
	}

	async getThread(threadId: string): Promise<ThreadDetailResponse> {
		return this.requestJson(`/v1/threads/${threadId}`, threadDetailResponseSchema);
	}

	async updateThreadPermissionMode(
		threadId: string,
		request: ThreadPermissionModeUpdateRequest,
	): Promise<ThreadDetailResponse> {
		return this.requestJson(`/v1/threads/${threadId}/permission-mode`, threadDetailResponseSchema, {
			body: request,
			method: "PATCH",
		});
	}

	async listThreadArtifacts(threadId: string): Promise<SessionArtifactListResponse> {
		return this.requestJson(`/v1/threads/${threadId}/artifacts`, sessionArtifactListResponseSchema);
	}

	async listCaptures(params?: { limit?: number }): Promise<CaptureListResponse> {
		const qs = params?.limit ? `?limit=${params.limit}` : "";
		return this.requestJson(`/v1/captures${qs}`, captureListResponseSchema);
	}

	async getCapture(captureId: string): Promise<CaptureDetailResponse> {
		return this.requestJson(`/v1/captures/${captureId}`, captureDetailResponseSchema);
	}

	async getCaptureTranscript(captureId: string): Promise<CaptureTranscriptResponse> {
		return this.requestJson(
			`/v1/captures/${captureId}/transcript`,
			captureTranscriptResponseSchema,
		);
	}

	async listToolPermissions(): Promise<AgentToolPermissionListResponse> {
		return this.requestJson("/v1/agent/tool-permissions", agentToolPermissionListResponseSchema);
	}

	async updateToolPermission(
		toolName: string,
		request: AgentToolPermissionUpdateRequest,
	): Promise<AgentToolPermissionActionResponse> {
		return this.requestJson(
			`/v1/agent/tool-permissions/${toolName}`,
			agentToolPermissionActionResponseSchema,
			{ body: request, method: "PUT" },
		);
	}

	// Note: GET /v1/agent/tools exists on the backend but returns raw catalog
	// entries without `userAvailability`, which toolCatalogResponseSchema requires —
	// it can never validate. Use listTools() (GET /v1/tools) instead.
	async listTools(): Promise<ToolCatalogResponse> {
		return this.requestJson("/v1/tools", toolCatalogResponseSchema);
	}

	// The backend has no status filter on this route; it returns all non-suppressed
	// notifications. Filter client-side if a subset is needed.
	async listNotifications(): Promise<NotificationListResponse> {
		return this.requestJson("/v1/notifications", notificationListResponseSchema);
	}

	async getNotification(id: string): Promise<NotificationDetailResponse> {
		return this.requestJson(`/v1/notifications/${id}`, notificationDetailResponseSchema);
	}

	async dismissNotification(id: string): Promise<NotificationActionResponse> {
		return this.requestJson(`/v1/notifications/${id}/dismiss`, notificationActionResponseSchema, {
			method: "POST",
		});
	}

	async snoozeNotification(
		id: string,
		request: NotificationSnoozeRequest,
	): Promise<NotificationActionResponse> {
		return this.requestJson(`/v1/notifications/${id}/snooze`, notificationActionResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async markNotificationOpened(id: string): Promise<NotificationActionResponse> {
		return this.requestJson(`/v1/notifications/${id}/opened`, notificationActionResponseSchema, {
			method: "POST",
		});
	}

	async listReminders(): Promise<ReminderListResponse> {
		return this.requestJson("/v1/reminders", reminderListResponseSchema);
	}

	async completeReminder(id: string): Promise<ReminderActionResponse> {
		return this.requestJson(`/v1/reminders/${id}/complete`, reminderActionResponseSchema, {
			method: "POST",
		});
	}

	async snoozeReminder(
		id: string,
		request: ReminderSnoozeRequest,
	): Promise<ReminderActionResponse> {
		return this.requestJson(`/v1/reminders/${id}/snooze`, reminderActionResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async getPrivacySettings(): Promise<PrivacySettings> {
		return this.requestJson("/v1/settings/privacy", privacySettingsSchema);
	}

	async updatePrivacySettings(request: PrivacySettingsUpdateRequest): Promise<PrivacySettings> {
		return this.requestJson("/v1/settings/privacy", privacySettingsSchema, {
			body: request,
			method: "PATCH",
		});
	}

	async getAgentAccountPolicy(): Promise<AgentAccountPolicyResponse> {
		return this.requestJson("/v1/agent/account-policy", agentAccountPolicyResponseSchema);
	}

	async updateAgentAccountPolicy(
		request: AgentAccountPolicyUpdateRequest,
	): Promise<AgentAccountPolicyResponse> {
		return this.requestJson("/v1/agent/account-policy", agentAccountPolicyResponseSchema, {
			body: request,
			method: "PATCH",
		});
	}

	async listNotificationPreferences(): Promise<NotificationPreferenceListResponse> {
		return this.requestJson(
			"/v1/notification-preferences",
			notificationPreferenceListResponseSchema,
		);
	}

	async updateNotificationPreferences(
		request: NotificationPreferenceUpdateRequest,
	): Promise<NotificationPreference> {
		return this.requestJson("/v1/notification-preferences", notificationPreferenceSchema, {
			body: request,
			method: "PATCH",
		});
	}

	async deleteAccount(): Promise<AccountDeleteResponse> {
		return this.requestJson("/v1/account/delete", accountDeleteResponseSchema, {
			method: "POST",
		});
	}

	async requestAccountExport(): Promise<AccountRequestResponse> {
		return this.requestJson("/v1/account/export-request", accountRequestResponseSchema, {
			method: "POST",
		});
	}

	async searchBrain(request: BrainSearchRequest): Promise<BrainSearchResponse> {
		const params = new URLSearchParams();
		params.set("q", request.q);
		params.set("limit", String(request.limit));
		return this.requestJson(`/v1/brain/search?${params.toString()}`, brainSearchResponseSchema);
	}

	// The backend caps `limit` at 100 and does not implement cursor pagination yet
	// (it always responds hasMore: false), so `limit` is the only paging lever.
	async listThreads(params?: { limit?: number }): Promise<ThreadListResponse> {
		const qs = params?.limit ? `?limit=${params.limit}` : "";
		const response = await this.requestJson(`/v1/threads${qs}`, threadListResponseSchema);
		return {
			...response,
			threads: sortSessions(response.threads),
		};
	}

	async createThread(request: ThreadCreateRequest): Promise<ThreadDetailResponse> {
		return this.requestJson("/v1/threads", threadDetailResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async listThreadMessages(threadId: string): Promise<ThreadMessageListResponse> {
		return this.requestJson(`/v1/threads/${threadId}/messages`, threadMessageListResponseSchema);
	}

	/** Durable transcript of past turns (tool cards + text), for cold reloads. */
	async listThreadEvents(threadId: string): Promise<ThreadEventsResponse> {
		return this.requestJson(`/v1/threads/${threadId}/events`, threadEventsResponseSchema);
	}

	async sendThreadMessage(
		threadId: string,
		request: ThreadMessageCreateRequest,
	): Promise<ThreadMessageSendResponse> {
		return this.requestJson(`/v1/threads/${threadId}/messages`, threadMessageSendResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async admitThreadMessage(
		request: ThreadMessageCreateRequest,
	): Promise<ThreadMessageSendResponse> {
		return this.requestJson("/v1/threads/admit", threadMessageSendResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async stopThreadGeneration(input: { sessionId?: string; threadId: string }): Promise<boolean> {
		const response = await this.requestJson(
			`/v1/threads/${input.threadId}/stop`,
			threadStopResponseSchema,
			{
				body: input.sessionId ? { sessionId: input.sessionId } : {},
				method: "POST",
			},
		);

		return response.stopped;
	}

	async listDocuments(params?: { query?: string }): Promise<DocumentListItem[]> {
		const qs = params?.query?.trim() ? `?query=${encodeURIComponent(params.query.trim())}` : "";
		const response = await this.requestJson(`/v1/documents${qs}`, documentListResponseSchema);
		return response.documents;
	}

	async createDocument(request: DocumentCreateRequest = {}): Promise<DocumentRecord> {
		const response = await this.requestJson("/v1/documents", documentDetailResponseSchema, {
			body: request,
			method: "POST",
		});
		return response.document;
	}

	async getDocument(documentId: string): Promise<DocumentRecord> {
		const response = await this.requestJson(
			`/v1/documents/${documentId}`,
			documentDetailResponseSchema,
		);
		return response.document;
	}

	async updateDocument(
		documentId: string,
		request: DocumentUpdateRequest,
	): Promise<DocumentRecord> {
		const response = await this.requestJson(
			`/v1/documents/${documentId}`,
			documentDetailResponseSchema,
			{ body: request, method: "PATCH" },
		);
		return response.document;
	}

	async deleteDocument(documentId: string): Promise<void> {
		await this.requestJson(`/v1/documents/${documentId}`, documentDeleteResponseSchema, {
			method: "DELETE",
		});
	}

	/** File export: returns the bytes plus the server-chosen filename. */
	async exportDocumentFile(
		documentId: string,
		format: DocumentExportFormat,
	): Promise<{ blob: Blob; filename: string }> {
		const response = await fetch(this.url(`/v1/documents/${documentId}/export?format=${format}`), {
			headers: await this.authHeaders(),
		});

		if (!response.ok) {
			const payload = await response.json().catch(() => null);
			const envelope = apiErrorResponseSchema.safeParse(payload);

			throw new WebApiError(
				envelope.success
					? envelope.data.error.message
					: `Export failed with status ${response.status}.`,
				response.status,
				envelope.success ? envelope.data.error.code : null,
			);
		}

		const disposition = response.headers.get("content-disposition") ?? "";
		const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `document.${format}`;

		return { blob: await response.blob(), filename };
	}

	async exportDocumentToGoogleDrive(
		documentId: string,
	): Promise<DocumentGoogleDriveExportResponse> {
		return this.requestJson(
			`/v1/documents/${documentId}/export/google-drive`,
			documentGoogleDriveExportResponseSchema,
			{ method: "POST" },
		);
	}

	async listSkills(params?: { query?: string }): Promise<SkillListItem[]> {
		const qs = params?.query?.trim() ? `?query=${encodeURIComponent(params.query.trim())}` : "";
		const response = await this.requestJson(`/v1/skills${qs}`, skillListResponseSchema);
		return response.skills;
	}

	async createSkill(request: SkillCreateRequest = {}): Promise<SkillRecord> {
		const response = await this.requestJson("/v1/skills", skillDetailResponseSchema, {
			body: request,
			method: "POST",
		});
		return response.skill;
	}

	async getSkill(skillId: string): Promise<SkillRecord> {
		const response = await this.requestJson(`/v1/skills/${skillId}`, skillDetailResponseSchema);
		return response.skill;
	}

	async updateSkill(skillId: string, request: SkillUpdateRequest): Promise<SkillRecord> {
		const response = await this.requestJson(`/v1/skills/${skillId}`, skillDetailResponseSchema, {
			body: request,
			method: "PATCH",
		});
		return response.skill;
	}

	async deleteSkill(skillId: string): Promise<void> {
		await this.requestJson(`/v1/skills/${skillId}`, skillDeleteResponseSchema, {
			method: "DELETE",
		});
	}

	async listConnections(): Promise<Connection[]> {
		const response = await this.requestJson("/v1/connections", connectionListResponseSchema);
		return response.connections;
	}

	async connectProvider(provider: ConnectionProvider): Promise<ConnectionConnectResponse> {
		return this.requestJson(
			`/v1/connections/${provider}/connect`,
			connectionConnectResponseSchema,
			{ method: "POST" },
		);
	}

	async disconnectProvider(provider: ConnectionProvider): Promise<ConnectionDisconnectResponse> {
		return this.requestJson(`/v1/connections/${provider}`, connectionDisconnectResponseSchema, {
			method: "DELETE",
		});
	}

	async getGmailMessage(messageId: string): Promise<ConnectorMessage> {
		return this.requestJson(
			`/v1/connectors/google/gmail/messages/${encodeURIComponent(messageId)}`,
			connectorMessageSchema,
		);
	}

	async listAutomations(): Promise<AutomationWithRelations[]> {
		const response = await this.requestJson("/v1/automations", automationListResponseSchema);
		return response.automations;
	}

	async listAutomationTemplates(): Promise<AutomationTemplate[]> {
		const response = await this.requestJson(
			"/v1/automations/templates",
			automationTemplateListResponseSchema,
		);
		return response.templates;
	}

	async createAutomation(request: AutomationCreateRequest): Promise<AutomationActionResponse> {
		return this.requestJson("/v1/automations", automationActionResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async getAutomation(automationId: string): Promise<AutomationDetailResponse> {
		return this.requestJson(`/v1/automations/${automationId}`, automationDetailResponseSchema);
	}

	async updateAutomation(
		automationId: string,
		request: AutomationUpdateRequest,
	): Promise<AutomationActionResponse> {
		return this.requestJson(`/v1/automations/${automationId}`, automationActionResponseSchema, {
			body: request,
			method: "PATCH",
		});
	}

	async updateAutomationSettings(
		automationId: string,
		request: AutomationSettingsUpdateRequest,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/settings`,
			automationActionResponseSchema,
			{
				body: request,
				method: "PATCH",
			},
		);
	}

	async updateAutomationAccountScope(
		automationId: string,
		request: AutomationAccountScopeUpdateRequest,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/account-scope`,
			automationActionResponseSchema,
			{
				body: request,
				method: "PATCH",
			},
		);
	}

	async createAutomationTrigger(
		automationId: string,
		request: AutomationTriggerCreateRequest,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/triggers`,
			automationActionResponseSchema,
			{
				body: request,
				method: "POST",
			},
		);
	}

	async updateAutomationTrigger(
		automationId: string,
		triggerId: string,
		request: AutomationTriggerUpdateRequest,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/triggers/${triggerId}`,
			automationActionResponseSchema,
			{
				body: request,
				method: "PATCH",
			},
		);
	}

	async disableAutomationTrigger(
		automationId: string,
		triggerId: string,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/triggers/${triggerId}`,
			automationActionResponseSchema,
			{ method: "DELETE" },
		);
	}

	async updateAutomationTools(
		automationId: string,
		request: AutomationToolsUpdateRequest,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/tools`,
			automationActionResponseSchema,
			{
				body: request,
				method: "PATCH",
			},
		);
	}

	async exportAutomation(automationId: string): Promise<AutomationExportResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/export`,
			automationExportResponseSchema,
		);
	}

	async getAutomationWebhook(automationId: string): Promise<AutomationWebhookActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/webhook`,
			automationWebhookActionResponseSchema,
		);
	}

	async updateAutomationWebhook(
		automationId: string,
		request: AutomationWebhookUpdateRequest,
	): Promise<AutomationWebhookActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/webhook`,
			automationWebhookActionResponseSchema,
			{
				body: request,
				method: "PATCH",
			},
		);
	}

	async runAutomation(
		automationId: string,
		input?: Record<string, unknown>,
	): Promise<AutomationInvocation> {
		const response = await this.requestJson<AutomationRunNowResponse>(
			`/v1/automations/${automationId}/run`,
			automationRunNowResponseSchema,
			{
				body: input ? { input } : {},
				method: "POST",
			},
		);

		return response.invocation;
	}

	async listAutomationInvocations(automationId: string): Promise<AutomationInvocation[]> {
		const response = await this.requestJson<AutomationInvocationListResponse>(
			`/v1/automations/${automationId}/invocations`,
			automationInvocationListResponseSchema,
		);
		return response.invocations;
	}

	async getAutomationRunDetail(input: {
		automationId: string;
		invocationId: string;
	}): Promise<AutomationRunDetailResponse> {
		return this.requestJson(
			`/v1/automations/${input.automationId}/invocations/${input.invocationId}`,
			automationRunDetailResponseSchema,
		);
	}

	async listAutomationMemories(automationId: string): Promise<AutomationMemoryResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/memories`,
			automationMemoryResponseSchema,
		);
	}

	// Omitting `status` returns approvals in every state (the history/audit view).
	async listApprovals(params?: {
		sessionId?: string;
		status?: AgentToolApprovalStatus;
	}): Promise<AgentToolApproval[]> {
		const search = new URLSearchParams();
		if (params?.status) {
			search.set("status", params.status);
		}
		if (params?.sessionId) {
			search.set("sessionId", params.sessionId);
		}
		const suffix = search.toString() ? `?${search.toString()}` : "";
		const response = await this.requestJson<AgentToolApprovalListResponse>(
			`/v1/agent/tool-approvals${suffix}`,
			agentToolApprovalListResponseSchema,
		);
		return response.approvals;
	}

	async listPendingApprovals(sessionId?: string): Promise<AgentToolApproval[]> {
		return this.listApprovals({ sessionId, status: "pending" });
	}

	async decideApproval(
		approvalId: string,
		request: AgentToolApprovalDecisionRequest,
	): Promise<AgentToolApprovalActionResponse> {
		return this.requestJson(
			`/v1/agent/tool-approvals/${approvalId}`,
			agentToolApprovalActionResponseSchema,
			{
				body: request,
				method: "POST",
			},
		);
	}

	async listThreadSources(threadId: string): Promise<SessionSourceListResponse> {
		return this.requestJson(`/v1/threads/${threadId}/sources`, sessionSourceListResponseSchema);
	}

	async listThreadWebSources(threadId: string): Promise<WebSourceListResponse> {
		return this.requestJson(`/v1/threads/${threadId}/web-sources`, webSourceListResponseSchema);
	}

	async getArtifact(artifactId: string): Promise<SessionArtifactDetailResponse> {
		return this.requestJson(`/v1/artifacts/${artifactId}`, sessionArtifactDetailResponseSchema);
	}

	async updateArtifact(
		artifactId: string,
		request: ArtifactUpdateRequest,
	): Promise<SessionArtifact> {
		const response = await this.requestJson(
			`/v1/artifacts/${artifactId}`,
			sessionArtifactDetailResponseSchema,
			{ body: request, method: "PATCH" },
		);
		return response.artifact;
	}

	async sendArtifactEmail(artifactId: string): Promise<SessionArtifactSendResponse> {
		return this.requestJson(`/v1/artifacts/${artifactId}/send`, sessionArtifactSendResponseSchema, {
			method: "POST",
		});
	}

	// There is no GET /v1/connections/:provider route; the directory list is the
	// only read. Derive a single provider's connection from listConnections().
	async getConnection(provider: ConnectionProvider): Promise<Connection | null> {
		const connections = await this.listConnections();
		return connections.find((connection) => connection.provider === provider) ?? null;
	}

	async restoreAutomationVersion(
		automationId: string,
		versionId: string,
	): Promise<AutomationActionResponse> {
		return this.requestJson(
			`/v1/automations/${automationId}/versions/${versionId}/restore`,
			automationActionResponseSchema,
			{ method: "POST" },
		);
	}

	async importAutomation(request: AutomationImportRequest): Promise<AutomationActionResponse> {
		return this.requestJson("/v1/automations/import", automationActionResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	async sendCompositionMessage(
		request: AutomationCompositionRequest,
	): Promise<AutomationCompositionResponse> {
		return this.requestJson("/v1/automations/composition", automationCompositionResponseSchema, {
			body: request,
			method: "POST",
		});
	}

	// ------------------------------------------------------------------
	// Internal eval API (/v1/internal/evals/*) — every route 404s for
	// non-internal accounts, mirroring the dashboard's not-found gating.
	// ------------------------------------------------------------------

	async listEvalRuns(filters: EvalRunListFilters = {}): Promise<EvalRunListResponse> {
		const params = new URLSearchParams();
		if (filters.status && filters.status.length > 0) {
			params.set("status", filters.status.join(","));
		}
		if (filters.suite) params.set("suite", filters.suite);
		if (filters.model) params.set("model", filters.model);
		if (filters.from) params.set("from", filters.from);
		if (filters.to) params.set("to", filters.to);
		if (filters.cursor) params.set("cursor", filters.cursor);
		if (filters.limit) params.set("limit", String(filters.limit));
		const suffix = params.toString() ? `?${params.toString()}` : "";
		return this.requestJson(`/v1/internal/evals/runs${suffix}`, evalRunListResponseSchema);
	}

	async getEvalRun(runId: string): Promise<EvalRunDetailResponse> {
		return this.requestJson(`/v1/internal/evals/runs/${runId}`, evalRunDetailResponseSchema);
	}

	async cancelEvalRun(runId: string): Promise<EvalRunWire> {
		const response = await this.requestJson(
			`/v1/internal/evals/runs/${runId}/cancel`,
			evalRunActionResponseSchema,
			{
				method: "POST",
			},
		);
		return response.run;
	}

	async blessEvalRun(runId: string): Promise<EvalBlessRunResponse> {
		return this.requestJson(`/v1/internal/evals/runs/${runId}/bless`, evalBlessRunResponseSchema, {
			method: "POST",
		});
	}

	/** 404 means "not an eval session" or "viewer is not internal" — both are
	 * normal and resolve to null so the session view can simply render nothing. */
	async getEvalSessionOverlay(sessionId: string): Promise<EvalSessionOverlayResponse | null> {
		try {
			return await this.requestJson(
				`/v1/internal/evals/sessions/${sessionId}`,
				evalSessionOverlayResponseSchema,
			);
		} catch (error) {
			if (error instanceof WebApiError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	/** Replay/tail of eval-run metric events. Reconnect policy is the caller's. */
	async streamEvalRunEvents(options: StreamEvalRunEventsOptions): Promise<void> {
		const params = new URLSearchParams();
		if (options.fromEventIndex !== undefined) {
			params.set("fromEventIndex", String(options.fromEventIndex));
		}
		const suffix = params.toString() ? `?${params.toString()}` : "";
		await readSseStream({
			headers: await this.authHeaders(),
			onActivity: options.onActivity,
			onEvent: options.onEvent,
			schema: evalRunEventWireSchema,
			signal: options.signal,
			url: this.url(`/v1/internal/evals/runs/${options.runId}/events${suffix}`),
		});
	}

	async streamThreadEvents(options: StreamThreadOptions): Promise<void> {
		const params = new URLSearchParams({ sessionId: options.sessionId });
		if (options.fromEventIndex !== undefined) {
			params.set("fromEventIndex", String(options.fromEventIndex));
		}

		await readSseStream({
			headers: await this.authHeaders(),
			onActivity: options.onActivity,
			onEvent: options.onEvent,
			schema: threadMessageStreamEventSchema,
			signal: options.signal,
			url: this.url(`/v1/threads/${options.threadId}/stream?${params.toString()}`),
		});
	}

	async streamAppEvents(options: StreamAppEventsOptions): Promise<void> {
		const params = new URLSearchParams();
		if (options.after !== undefined) {
			params.set("after", String(options.after));
		}

		const suffix = params.toString() ? `?${params.toString()}` : "";
		try {
			await readSseStream({
				headers: await this.authHeaders(),
				onActivity: options.onActivity,
				onEvent: options.onEvent,
				schema: appEventSchema,
				signal: options.signal,
				url: this.url(`/v1/events${suffix}`),
			});
		} catch (error) {
			if (error instanceof SseRequestError) {
				if (error.status === 401) {
					this.onUnauthorized?.();
				}
				throw new WebApiError(
					error.detail ?? `SSE request failed with status ${error.status}.`,
					error.status,
				);
			}

			throw error;
		}
	}

	private async requestJson<T>(
		path: string,
		schema: z.ZodType<T>,
		options: RequestOptions = {},
	): Promise<T> {
		const { payload, response } = await this.withRequestTimeout(async (signal) => {
			const response = await fetch(this.url(path), {
				body: options.body === undefined ? undefined : JSON.stringify(options.body),
				headers: {
					...(await this.authHeaders()),
					"content-type": "application/json",
				},
				method: options.method ?? "GET",
				signal,
			});
			const payload = await response.json().catch(() => null);

			return { payload, response };
		});

		if (!response.ok) {
			if (response.status === 401) {
				this.onUnauthorized?.();
			}
			const envelope = apiErrorResponseSchema.safeParse(payload);
			if (envelope.success) {
				throw new WebApiError(
					envelope.data.error.message,
					response.status,
					envelope.data.error.code,
				);
			}
			throw new WebApiError(`Request failed with status ${response.status}.`, response.status);
		}

		return schema.parse(payload);
	}

	private async withRequestTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
		if (!(Number.isFinite(this.requestTimeoutMs) && this.requestTimeoutMs > 0)) {
			return operation(new AbortController().signal);
		}

		const controller = new AbortController();
		let timedOut = false;
		let timeout: ReturnType<typeof setTimeout> | null = null;
		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeout = setTimeout(() => {
				timedOut = true;
				controller.abort();
				reject(new WebApiError("Request timed out.", 408, "request_timeout"));
			}, this.requestTimeoutMs);
		});
		const operationPromise = operation(controller.signal).catch((error) => {
			if (timedOut || isAbortError(error)) {
				throw new WebApiError("Request timed out.", 408, "request_timeout");
			}

			throw error;
		});

		try {
			return await Promise.race([operationPromise, timeoutPromise]);
		} finally {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
	}

	private async authHeaders(): Promise<Record<string, string>> {
		const token = await this.getToken();

		if (!token) {
			this.onUnauthorized?.();
			throw new WebApiError("A bearer token is required.", 401);
		}

		return {
			authorization: `Bearer ${token}`,
		};
	}

	private url(path: string): string {
		if (!this.apiBaseUrl) {
			throw new WebApiError("NEXT_PUBLIC_API_BASE_URL is not configured.", 400);
		}

		return `${this.apiBaseUrl}${path}`;
	}
}

function sortSessions(sessions: Session[]): Session[] {
	return [...sessions].sort((left, right) => {
		const leftAt = left.lastMessageAt ?? left.updatedAt ?? left.createdAt;
		const rightAt = right.lastMessageAt ?? right.updatedAt ?? right.createdAt;
		return rightAt.localeCompare(leftAt);
	});
}
