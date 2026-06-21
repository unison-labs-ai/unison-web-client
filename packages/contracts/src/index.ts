import { z } from "zod";
import { automationModeSchema } from "./automations";
import {
	agentToolPermissionDecisionSchema,
	agentToolSideEffectClassSchema,
	connectionProviderSchema,
	isoDateTimeSchema,
	metadataSchema,
	paginationResponseSchema,
	uuidSchema,
} from "./shared";

export * from "./automations";
export * from "./documents";
export * from "./evals";
export * from "./shared";
export * from "./skills";
export * from "./trigger-reference";

/** The single source of truth for Google OAuth scope URLs. Every package that
 * names a Google scope (tool definitions, the google connector, the engine,
 * runtime jobs, eval fixtures) imports it from here — never a local literal.
 * `calendarFull` / `calendarRead` / `gmailFull` / `gmailRead` / `gmailCompose` /
 * `gmailSend` are not requested by the connect flow; they exist so scope
 * *matchers* can accept tokens granted with broader/legacy scopes elsewhere. The
 * connect flow requests a single `gmailModify`, which supersedes gmail
 * read/compose/send (one restricted scope instead of three). */
export const GOOGLE_OAUTH_SCOPE = {
	calendarEvents: "https://www.googleapis.com/auth/calendar.events",
	calendarFull: "https://www.googleapis.com/auth/calendar",
	calendarRead: "https://www.googleapis.com/auth/calendar.readonly",
	contactsOtherRead: "https://www.googleapis.com/auth/contacts.other.readonly",
	contactsRead: "https://www.googleapis.com/auth/contacts.readonly",
	docs: "https://www.googleapis.com/auth/documents",
	driveFile: "https://www.googleapis.com/auth/drive.file",
	gmailCompose: "https://www.googleapis.com/auth/gmail.compose",
	gmailFull: "https://mail.google.com/",
	gmailModify: "https://www.googleapis.com/auth/gmail.modify",
	gmailRead: "https://www.googleapis.com/auth/gmail.readonly",
	gmailSend: "https://www.googleapis.com/auth/gmail.send",
	sheets: "https://www.googleapis.com/auth/spreadsheets",
} as const;

export const googleWorkspaceScopes = [
	"openid",
	"email",
	"profile",
	GOOGLE_OAUTH_SCOPE.calendarEvents,
	GOOGLE_OAUTH_SCOPE.gmailModify,
	GOOGLE_OAUTH_SCOPE.contactsRead,
	GOOGLE_OAUTH_SCOPE.contactsOtherRead,
	GOOGLE_OAUTH_SCOPE.driveFile,
] as const;

/** Granola's official public API authenticates with per-user API keys, not
 * OAuth; this internal scope tag keeps capability/tool declarations uniform
 * across connectors (requiredScopes ⊆ requested checks). */
export const GRANOLA_SCOPE = {
	notesRead: "granola.notes:read",
} as const;

/** Telegram Bot API authenticates with a bot token (no OAuth, no per-user
 * scopes). This internal scope tag keeps the requiredScopes array non-empty for
 * connectors that need a consistent declared-scopes ⊆ requested-scopes check.
 * Bot tokens carry all permissions granted when the bot was created — there is
 * no per-scope grant flow. */
export const TELEGRAM_SCOPE = {
	botApi: "telegram.bot:api",
} as const;

export const healthzResponseSchema = z.object({
	ok: z.literal(true),
	service: z.enum(["api", "worker", "mobile"]),
	version: z.string().min(1),
	timestamp: isoDateTimeSchema,
});

export type HealthzResponse = z.infer<typeof healthzResponseSchema>;

export function createHealthzResponse(
	service: HealthzResponse["service"],
	now: Date = new Date(),
): HealthzResponse {
	return {
		ok: true,
		service,
		version: "0.0.0",
		timestamp: now.toISOString(),
	};
}

export const apiErrorCodeSchema = z.enum([
	"bad_request",
	"unauthorized",
	"forbidden",
	"not_found",
	"conflict",
	"thread_busy",
	"rate_limited",
	"validation_failed",
	"internal_error",
	// Document → Drive export preconditions (412): the web client maps these
	// to a "connect/reconnect Google" call to action.
	"google_not_connected",
	"google_scope_missing",
]);

export const apiErrorResponseSchema = z.object({
	error: z.object({
		code: apiErrorCodeSchema,
		message: z.string().min(1),
		details: z.unknown().optional(),
		requestId: z.string().min(1).optional(),
	}),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export const profileSchema = z.object({
	id: uuidSchema,
	email: z.string().email().nullable(),
	displayName: z.string().nullable(),
	avatarUrl: z.string().url().nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const personalBrainSchema = z.object({
	id: uuidSchema,
	displayName: z.string().min(1),
	status: z.enum(["active", "disabled", "deleted"]),
	role: z.enum(["owner", "member"]),
	isDefault: z.boolean(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const brainInitStatusSchema = z.enum(["queued", "already_queued", "ready", "disabled"]);

export const mobileFeatureFlagsSchema = z.object({
	capture: z.boolean(),
	chat: z.boolean(),
	connectors: z.boolean(),
	notifications: z.boolean(),
	rawAudioUpload: z.boolean(),
});

export const recommendedNextActionSchema = z.enum([
	"register_device",
	"start_capture",
	"connect_google",
	"none",
]);

export const authContextSchema = z.object({
	userId: uuidSchema,
	profileId: uuidSchema,
	tenantId: uuidSchema,
});

export const meResponseSchema = z.object({
	auth: authContextSchema,
	profile: profileSchema,
	tenant: personalBrainSchema,
	featureFlags: mobileFeatureFlagsSchema,
});

export type Profile = z.infer<typeof profileSchema>;
export type PersonalBrain = z.infer<typeof personalBrainSchema>;
export type BrainInitStatus = z.infer<typeof brainInitStatusSchema>;
export type MobileFeatureFlags = z.infer<typeof mobileFeatureFlagsSchema>;
export type RecommendedNextAction = z.infer<typeof recommendedNextActionSchema>;
export type AuthContext = z.infer<typeof authContextSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export const bootstrapRequestSchema = z.object({
	displayName: z.string().trim().min(1).max(120).optional(),
	timezone: z.string().trim().min(1).max(120).optional(),
});

export const bootstrapResponseSchema = z.object({
	auth: authContextSchema,
	profile: profileSchema,
	tenant: personalBrainSchema,
	brainInitStatus: brainInitStatusSchema,
	featureFlags: mobileFeatureFlagsSchema,
	recommendedNextAction: recommendedNextActionSchema,
});

export type BootstrapRequest = z.infer<typeof bootstrapRequestSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;

export const devicePlatformSchema = z.enum(["ios", "android"]);
export const pushTokenProviderSchema = z.enum(["fcm", "apns", "expo"]);

export const deviceRegistrationRequestSchema = z.object({
	deviceInstallId: z.string().trim().min(1).max(200),
	platform: devicePlatformSchema,
	deviceName: z.string().trim().min(1).max(200).nullable().optional(),
	appVersion: z.string().trim().min(1).max(80).nullable().optional(),
	osVersion: z.string().trim().min(1).max(80).nullable().optional(),
	pushToken: z.string().trim().min(1).max(512).nullable().optional(),
	pushTokenProvider: pushTokenProviderSchema.nullable().optional(),
	metadata: metadataSchema.default({}),
});

export const deviceUpdateRequestSchema = z
	.object({
		deviceName: z.string().trim().min(1).max(200).nullable().optional(),
		appVersion: z.string().trim().min(1).max(80).nullable().optional(),
		osVersion: z.string().trim().min(1).max(80).nullable().optional(),
		pushToken: z.string().trim().min(1).max(512).nullable().optional(),
		pushTokenProvider: pushTokenProviderSchema.nullable().optional(),
		metadata: metadataSchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one device field must be provided.",
	});

export const mobileDeviceSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	deviceInstallId: z.string().min(1),
	platform: devicePlatformSchema,
	deviceName: z.string().nullable(),
	appVersion: z.string().nullable(),
	osVersion: z.string().nullable(),
	pushToken: z.string().nullable(),
	pushTokenProvider: pushTokenProviderSchema.nullable(),
	lastSeenAt: isoDateTimeSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const deviceHeartbeatResponseSchema = z.object({
	device: mobileDeviceSchema,
});

export const deviceDeleteResponseSchema = z.object({
	deleted: z.literal(true),
});

export type DevicePlatform = z.infer<typeof devicePlatformSchema>;
export type PushTokenProvider = z.infer<typeof pushTokenProviderSchema>;
export type DeviceRegistrationRequest = z.infer<typeof deviceRegistrationRequestSchema>;
export type DeviceUpdateRequest = z.infer<typeof deviceUpdateRequestSchema>;
export type MobileDevice = z.infer<typeof mobileDeviceSchema>;
export type DeviceHeartbeatResponse = z.infer<typeof deviceHeartbeatResponseSchema>;
export type DeviceDeleteResponse = z.infer<typeof deviceDeleteResponseSchema>;

export const rawAudioRetentionSchema = z.enum(["none", "until_transcribed", "keep"]);

export const privacySettingsSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	rawAudioRetention: rawAudioRetentionSchema,
	storeTranscripts: z.boolean(),
	allowConnectorIngestion: z.boolean(),
	allowAiNotificationSummaries: z.boolean(),
	showNotificationContentPreviews: z.boolean(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const privacySettingsUpdateRequestSchema = z
	.object({
		rawAudioRetention: rawAudioRetentionSchema.optional(),
		storeTranscripts: z.boolean().optional(),
		allowConnectorIngestion: z.boolean().optional(),
		allowAiNotificationSummaries: z.boolean().optional(),
		showNotificationContentPreviews: z.boolean().optional(),
		metadata: metadataSchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one privacy field must be provided.",
	});

export type RawAudioRetention = z.infer<typeof rawAudioRetentionSchema>;
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type PrivacySettingsUpdateRequest = z.infer<typeof privacySettingsUpdateRequestSchema>;

// Capture recording limits — the single source of truth. Clients (auto-stop,
// clamps), the API schemas below, the persistence clamp, and the DB CHECK
// constraints (see the capture_duration_90min migration) must all agree on
// these values.
export const MAX_CAPTURE_DURATION_MS = 5_400_000; // 90 minutes
export const MAX_CAPTURE_TRANSCRIPT_CHARS = 200_000;
export const MAX_CAPTURE_SEGMENTS = 4_000;

export const captureStatusSchema = z.enum([
	"draft",
	"recording",
	"transcribing",
	"finalized",
	"processing",
	"processed",
	"failed",
	"deleted",
]);

export type CaptureStatus = z.infer<typeof captureStatusSchema>;

export const captureTypeSchema = z.enum(["mixed", "text", "voice"]);
export const captureModeSchema = z.enum(["locked", "press_hold", "text"]);
export const captureIntentSchema = z.enum(["meeting", "note", "request", "unknown"]);

export const transcriptSegmentSchema = z.object({
	index: z.number().int().min(0),
	text: z.string().trim().min(1).max(4000),
	startMs: z.number().int().min(0).optional(),
	endMs: z.number().int().min(0).optional(),
	confidence: z.number().min(0).max(1).optional(),
	isFinal: z.boolean().default(true),
	metadata: metadataSchema.default({}),
});

export const captureSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	clientCaptureId: z.string().min(1),
	captureType: captureTypeSchema,
	status: captureStatusSchema,
	intent: captureIntentSchema.nullable().default(null),
	intentConfidence: z.number().min(0).max(1).nullable().default(null),
	title: z.string().nullable(),
	summary: z.string().nullable(),
	transcriptText: z.string().nullable(),
	transcriptLanguage: z.string().nullable(),
	transcriptConfidence: z.number().nullable(),
	durationMs: z.number().int().min(0).nullable(),
	startedAt: isoDateTimeSchema.nullable(),
	finalizedAt: isoDateTimeSchema.nullable(),
	rawAudioStoragePath: z.string().nullable(),
	rawAudioRetained: z.boolean(),
	processingError: z.string().nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

// The first message of a capture session for an actionable recording (a meeting
// or a note) is a short, humanized prompt rendered as the user's own message,
// with the recording attached as a chip above it. This metadata is what the
// client reads to render that chip (title + classification) and to open the raw
// transcript. Spoken requests skip this entirely — their transcript becomes the
// user message verbatim, so they carry no capture_prompt metadata.
export const CAPTURE_PROMPT_MESSAGE_KIND = "capture_prompt";

export const capturePromptMetadataSchema = z.object({
	kind: z.literal(CAPTURE_PROMPT_MESSAGE_KIND),
	captureId: uuidSchema,
	intent: captureIntentSchema,
	title: z.string().trim().min(1).nullable(),
});

export type CapturePromptMetadata = z.infer<typeof capturePromptMetadataSchema>;

export const transcriptionRealtimeTokenResponseSchema = z.object({
	audioFormat: z.literal("pcm_16000"),
	expiresAt: isoDateTimeSchema,
	modelId: z.literal("scribe_v2_realtime"),
	provider: z.literal("elevenlabs"),
	token: z.string().min(1),
	websocketUrl: z.string().url(),
});

export const captureAudioStartRequestSchema = z.object({
	clientCaptureId: z.string().trim().min(1).max(120),
	languageHint: z.string().trim().min(2).max(32).optional(),
	metadata: metadataSchema.default({}),
	mode: captureModeSchema.default("press_hold"),
	timezone: z.string().trim().min(1).max(120).optional(),
});

export const captureTranscriptRequestSchema = z.object({
	audioObjectReference: z.string().trim().min(1).max(500).optional(),
	captureId: uuidSchema.optional(),
	clientCaptureId: z.string().trim().min(1).max(120),
	durationMs: z.number().int().min(0).max(MAX_CAPTURE_DURATION_MS).optional(),
	languageHint: z.string().trim().min(2).max(32).optional(),
	metadata: metadataSchema.default({}),
	mode: captureModeSchema.default("press_hold"),
	segments: z.array(transcriptSegmentSchema).max(MAX_CAPTURE_SEGMENTS).default([]),
	timezone: z.string().trim().min(1).max(120).optional(),
	transcript: z.string().trim().min(1).max(MAX_CAPTURE_TRANSCRIPT_CHARS),
	transcriptConfidence: z.number().min(0).max(1).optional(),
});

export const captureFinishRequestSchema = captureTranscriptRequestSchema
	.omit({ captureId: true, clientCaptureId: true })
	.extend({
		clientCaptureId: z.string().trim().min(1).max(120).optional(),
	});

export const captureRetryResponseSchema = z.object({
	capture: captureSchema,
	queued: z.boolean(),
});

export const captureListResponseSchema = z.object({
	captures: z.array(captureSchema),
	pagination: paginationResponseSchema,
});

export const captureDetailResponseSchema = z.object({
	capture: captureSchema,
});

export const captureAudioStartResponseSchema = z.object({
	capture: captureSchema,
});

export const captureDeleteResponseSchema = z.object({
	deleted: z.boolean(),
});

export const captureTranscriptResponseSchema = z.object({
	captureId: uuidSchema,
	finalized: z.boolean(),
	segments: z.array(transcriptSegmentSchema),
	transcript: z.string(),
});

// Safety-cache audio upload: the client records 16kHz mono PCM16 part files
// alongside realtime transcription and uploads them only when the realtime
// transcript came back incomplete (a network gap or drain-ceiling truncation),
// so the worker can recover the missing words from the audio.
export const captureAudioUploadReasonSchema = z.enum(["repair"]);

export const captureAudioUploadPartSchema = z.object({
	byteSize: z
		.number()
		.int()
		.min(1)
		.max(64 * 1024 * 1024),
	index: z.number().int().min(0),
});

export const captureAudioUploadUrlRequestSchema = z.object({
	parts: z.array(captureAudioUploadPartSchema).min(1).max(120),
	reason: captureAudioUploadReasonSchema,
	sampleRate: z.literal(16_000).default(16_000),
});

export const captureAudioUploadTargetSchema = z.object({
	index: z.number().int().min(0),
	path: z.string().min(1),
	token: z.string().min(1),
	url: z.string().url(),
});

export const captureAudioUploadUrlResponseSchema = z.object({
	captureId: uuidSchema,
	storagePrefix: z.string().min(1),
	uploads: z.array(captureAudioUploadTargetSchema),
});

export const captureAudioUploadCompleteRequestSchema = z.object({
	parts: z.array(captureAudioUploadPartSchema).min(1).max(120),
	reason: captureAudioUploadReasonSchema,
	sampleRate: z.literal(16_000).default(16_000),
});

export const captureAudioUploadCompleteResponseSchema = z.object({
	capture: captureSchema,
	queued: z.boolean(),
});

export type CaptureType = z.infer<typeof captureTypeSchema>;
export type CaptureMode = z.infer<typeof captureModeSchema>;
export type CaptureIntent = z.infer<typeof captureIntentSchema>;
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type Capture = z.infer<typeof captureSchema>;
export type TranscriptionRealtimeTokenResponse = z.infer<
	typeof transcriptionRealtimeTokenResponseSchema
>;
export type CaptureAudioStartRequest = z.infer<typeof captureAudioStartRequestSchema>;
export type CaptureTranscriptRequest = z.infer<typeof captureTranscriptRequestSchema>;
export type CaptureFinishRequest = z.infer<typeof captureFinishRequestSchema>;
export type CaptureListResponse = z.infer<typeof captureListResponseSchema>;
export type CaptureDetailResponse = z.infer<typeof captureDetailResponseSchema>;
export type CaptureAudioStartResponse = z.infer<typeof captureAudioStartResponseSchema>;
export type CaptureDeleteResponse = z.infer<typeof captureDeleteResponseSchema>;
export type CaptureRetryResponse = z.infer<typeof captureRetryResponseSchema>;
export type CaptureTranscriptResponse = z.infer<typeof captureTranscriptResponseSchema>;
export type CaptureAudioUploadReason = z.infer<typeof captureAudioUploadReasonSchema>;
export type CaptureAudioUploadPart = z.infer<typeof captureAudioUploadPartSchema>;
export type CaptureAudioUploadUrlRequest = z.infer<typeof captureAudioUploadUrlRequestSchema>;
export type CaptureAudioUploadTarget = z.infer<typeof captureAudioUploadTargetSchema>;
export type CaptureAudioUploadUrlResponse = z.infer<typeof captureAudioUploadUrlResponseSchema>;
export type CaptureAudioUploadCompleteRequest = z.infer<
	typeof captureAudioUploadCompleteRequestSchema
>;
export type CaptureAudioUploadCompleteResponse = z.infer<
	typeof captureAudioUploadCompleteResponseSchema
>;

export const agentMessageRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export const threadTypeSchema = z.enum(["capture", "connector_event", "freeform"]);
export const threadOriginSchema = z.enum(["automation", "capture", "connector", "system", "user"]);
export const threadStatusSchema = z.enum(["open", "archived", "deleted"]);
export const sessionSourceKindSchema = z.enum([
	// "automation" predates the run-scoped kind; the DB CHECK still accepts it
	// and historical rows may carry it, so the wire schema reads it too. New
	// writes use "automation_run".
	"automation",
	"automation_run",
	"capture",
	"document",
	"scheduled_session",
	"source_event",
	"system",
]);
export const sessionSourceRoleSchema = z.enum(["context", "primary", "result", "trigger"]);

export const sessionSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	type: threadTypeSchema,
	origin: threadOriginSchema.default("user"),
	captureId: uuidSchema.nullable(),
	permissionMode: z.enum(["ask", "allow_safe", "allow_all"]).default("ask"),
	title: z.string().nullable(),
	status: threadStatusSchema,
	lastMessageAt: isoDateTimeSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const threadCreateRequestSchema = z.object({
	type: threadTypeSchema.default("freeform"),
	captureId: uuidSchema.optional(),
	permissionMode: z.enum(["ask", "allow_safe", "allow_all"]).optional(),
	title: z.string().trim().min(1).max(160).optional(),
	metadata: metadataSchema.default({}),
});

export const chatPermissionModeSchema = z.enum(["ask", "allow_safe", "allow_all"]);

export const agentAccountPolicySchema = z.object({
	tenantId: uuidSchema,
	userId: uuidSchema,
	chatDefaultMode: chatPermissionModeSchema,
	lastChatPermissionMode: chatPermissionModeSchema.nullable(),
	automationDefaultMode: automationModeSchema,
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const agentAccountPolicyUpdateRequestSchema = z
	.object({
		chatDefaultMode: chatPermissionModeSchema.optional(),
		lastChatPermissionMode: chatPermissionModeSchema.nullable().optional(),
		automationDefaultMode: automationModeSchema.optional(),
		metadata: metadataSchema.optional(),
	})
	.refine(
		(value) =>
			value.chatDefaultMode !== undefined ||
			value.lastChatPermissionMode !== undefined ||
			value.automationDefaultMode !== undefined ||
			value.metadata !== undefined,
		{ message: "At least one account policy field must be provided." },
	);

export const agentAccountPolicyResponseSchema = z.object({
	policy: agentAccountPolicySchema,
});

export const threadPermissionModeUpdateRequestSchema = z.object({
	permissionMode: chatPermissionModeSchema,
});

export const sessionSourceSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	threadId: uuidSchema,
	sourceKind: sessionSourceKindSchema,
	sourceId: uuidSchema,
	role: sessionSourceRoleSchema,
	snapshot: metadataSchema,
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const threadListResponseSchema = z.object({
	pagination: paginationResponseSchema,
	threads: z.array(sessionSchema),
});

export const sessionSourceListResponseSchema = z.object({
	sources: z.array(sessionSourceSchema),
});

export const sessionArtifactKindSchema = z.enum([
	"email_draft",
	"report",
	"dossier",
	"briefing",
	"ledger",
]);
export const sessionArtifactStatusSchema = z.enum(["active", "deleted", "superseded"]);

export const sessionArtifactSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	sessionId: uuidSchema,
	agentRunId: uuidSchema.nullable(),
	toolCallId: uuidSchema.nullable(),
	artifactKind: sessionArtifactKindSchema,
	title: z.string().nullable(),
	status: sessionArtifactStatusSchema,
	payload: metadataSchema,
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const sessionArtifactListResponseSchema = z.object({
	artifacts: z.array(sessionArtifactSchema),
});

export const sessionArtifactDetailResponseSchema = z.object({
	artifact: sessionArtifactSchema,
});

/**
 * Wire body for PATCH /v1/artifacts/:id — user edits to an `email_draft`
 * artifact's payload (the only editable kind). All content fields are optional
 * but at least one must be present (mirrors documentUpdateRequestSchema). The
 * route shallow-merges these into `payload`. `baseUpdatedAt` is an optimistic
 * concurrency token: when present and stale the API answers 409 conflict
 * instead of clobbering (the artifact has no integer version, so `updated_at`
 * is the token — same role documents give `baseVersion`).
 */
export const artifactUpdateRequestSchema = z
	.object({
		subject: z.string().optional(),
		body: z.string().optional(),
		to: z.string().optional(),
		cc: z.array(z.string()).optional(),
		bcc: z.array(z.string()).optional(),
		baseUpdatedAt: isoDateTimeSchema.optional(),
	})
	.refine(
		(value) =>
			value.subject !== undefined ||
			value.body !== undefined ||
			value.to !== undefined ||
			value.cc !== undefined ||
			value.bcc !== undefined,
		{ message: "At least one of subject, body, to, cc, or bcc must be provided." },
	);

/**
 * Response for POST /v1/artifacts/:id/send. The artifact comes back marked
 * sent (`payload.state === "sent"`, `status === "superseded"`); `sentMessageId`
 * is the Gmail message id when the send returned one.
 */
export const sessionArtifactSendResponseSchema = z.object({
	artifact: sessionArtifactSchema,
	sentMessageId: z.string().optional(),
});

export const webSourceKindSchema = z.enum(["extracted_page", "pdf", "search_result"]);
export const webSourceStatusSchema = z.enum(["blocked", "extracted", "failed", "found"]);
export const webSourceSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	threadId: uuidSchema,
	agentRunId: uuidSchema.nullable(),
	provider: z.literal("tavily"),
	sourceKind: webSourceKindSchema,
	query: z.string().nullable(),
	url: z.string().url(),
	canonicalUrl: z.string().url().nullable(),
	title: z.string().nullable(),
	description: z.string().nullable(),
	publishedAt: isoDateTimeSchema.nullable(),
	fetchedAt: isoDateTimeSchema.nullable(),
	contentHash: z.string().nullable(),
	excerpt: z.string().nullable(),
	summary: z.string().nullable(),
	status: webSourceStatusSchema,
	error: z.string().nullable(),
	safety: metadataSchema,
	metadata: metadataSchema,
	citationKey: z.string().min(1),
	createdAt: isoDateTimeSchema,
});
export const webSourceListResponseSchema = z.object({
	sources: z.array(webSourceSchema),
});

export const threadDetailResponseSchema = z.object({
	thread: sessionSchema,
});

export const agentRunStatusSchema = z.enum(["active", "cancelled", "completed", "failed"]);
export const agentRunTriggerSchema = z.enum([
	"automation",
	"capture",
	"handoff",
	"reflection",
	"scheduled",
	"user",
]);

export const agentRunSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	threadId: uuidSchema,
	turnId: uuidSchema,
	status: agentRunStatusSchema,
	trigger: agentRunTriggerSchema.default("user"),
	stopRequestedAt: isoDateTimeSchema.nullable().default(null),
	model: z.string().nullable(),
	provider: z.string().nullable(),
	startedAt: isoDateTimeSchema,
	endedAt: isoDateTimeSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const agentToolApprovalStatusSchema = z.enum([
	"pending",
	"approved",
	"rejected",
	"expired",
	"cancelled",
]);

export const agentToolPermissionSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	toolName: z.string().min(1),
	permission: agentToolPermissionDecisionSchema,
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const agentToolApprovalSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	sessionId: uuidSchema,
	toolCallId: uuidSchema,
	toolName: z.string().min(1),
	status: agentToolApprovalStatusSchema,
	input: metadataSchema,
	requestedReason: z.string().nullable(),
	decisionNote: z.string().nullable(),
	decidedAt: isoDateTimeSchema.nullable(),
	expiresAt: isoDateTimeSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const agentToolPermissionUpdateRequestSchema = z.object({
	permission: agentToolPermissionDecisionSchema,
});

export const agentToolApprovalDecisionRequestSchema = z.object({
	decision: z.enum(["approve", "reject"]),
	escalate: z.literal("always_allow").optional(),
	note: z.string().trim().min(1).max(1000).optional(),
});

export const agentToolPermissionListResponseSchema = z.object({
	permissions: z.array(agentToolPermissionSchema),
});

export const agentToolPermissionActionResponseSchema = z.object({
	permission: agentToolPermissionSchema,
});

export const agentToolApprovalListResponseSchema = z.object({
	approvals: z.array(agentToolApprovalSchema),
});

export const agentToolApprovalActionResponseSchema = z.object({
	approval: agentToolApprovalSchema,
});

export const toolSurfaceSchema = z.enum(["chat", "automation", "anchored"]);
export const toolVisibilitySchema = z.enum([
	"direct",
	"deferred",
	"anchor_direct_else_deferred",
	"hidden",
]);
export const toolPolicyModeSchema = z.enum(["fixed", "required", "user_toggleable"]);

export const toolUserAvailabilitySchema = z.object({
	healthy: z.boolean(),
	missingScopes: z.array(z.string()),
	provider: z.string().nullable(),
	reason: z.string().nullable(),
	required: z.boolean(),
	status: z.enum(["healthy", "missing", "partial"]),
});

export const toolCatalogEntrySchema = z.object({
	auditRedaction: z.object({ fields: z.array(z.string()) }).optional(),
	availability: z.enum(["available", "beta", "disabled"]),
	canAlwaysAllow: z.boolean().default(true),
	category: z.string().min(1),
	defaultPermission: agentToolPermissionDecisionSchema,
	description: z.string().min(1),
	displayGroup: z.string().nullable(),
	name: z.string().min(1),
	origin: z.enum(["connector", "engine", "internal"]),
	outboundDelivery: z.enum(["always", "input_dependent", "never"]).default("never"),
	parameters: metadataSchema,
	policyMode: toolPolicyModeSchema,
	requiredConnection: z.string().nullable(),
	requiredScopes: z.array(z.string()),
	sideEffectClass: agentToolSideEffectClassSchema,
	surfaces: z.array(toolSurfaceSchema).min(1),
	title: z.string().min(1),
	toolsetId: z.string().min(1),
	visibility: toolVisibilitySchema,
});

export const toolCatalogEntryWithAvailabilitySchema = toolCatalogEntrySchema.extend({
	userAvailability: toolUserAvailabilitySchema,
});

export const toolCatalogResponseSchema = z.object({
	tools: z.array(toolCatalogEntryWithAvailabilitySchema),
});

export const attachmentKindSchema = z.enum(["image"]);
export const attachmentMimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const attachmentCreateSchema = z.object({
	kind: attachmentKindSchema,
	storagePath: z.string().trim().min(1).max(1024),
	mimeType: attachmentMimeTypeSchema,
	width: z.number().int().positive().nullable(),
	height: z.number().int().positive().nullable(),
	sizeBytes: z.number().int().nonnegative(),
});

export const messageAttachmentSchema = attachmentCreateSchema.extend({
	id: uuidSchema,
	displayUrl: z.string().url().nullable().optional(),
});

export const threadMessageSchema = z.object({
	id: uuidSchema,
	threadId: uuidSchema,
	sessionId: uuidSchema.nullable(),
	messageSeq: z.number().int().positive(),
	turnId: uuidSchema,
	parentMessageId: uuidSchema.nullable(),
	clientMessageId: z.string().trim().min(1).max(200).nullable(),
	role: agentMessageRoleSchema,
	content: z.string(),
	contentFormat: z.enum(["json", "markdown", "text"]).default("text"),
	status: z.enum(["streaming", "complete", "failed"]),
	attachments: z.array(messageAttachmentSchema).default([]),
	metadata: metadataSchema.default({}),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema.optional(),
});

export const threadMessageCreateRequestSchema = z
	.object({
		clientMessageId: z.string().trim().min(1).max(200).optional(),
		content: z.string().trim().max(8000).default(""),
		attachments: z.array(attachmentCreateSchema).max(4).default([]),
		permissionMode: chatPermissionModeSchema.optional(),
	})
	.refine((value) => value.content.length > 0 || value.attachments.length > 0, {
		message: "Message content or at least one attachment is required.",
	});

export const threadMessageListResponseSchema = z.object({
	messages: z.array(threadMessageSchema),
	thread: sessionSchema,
});

export const threadMessageSendResponseSchema = z.object({
	assistantMessage: threadMessageSchema,
	session: agentRunSchema,
	thread: sessionSchema,
	userMessage: threadMessageSchema,
});

export const threadMessageStreamEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("message.delta"),
		sessionId: uuidSchema,
		threadId: uuidSchema,
		turnId: uuidSchema,
		messageId: uuidSchema,
		delta: z.string(),
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("message.text.completed"),
		sessionId: uuidSchema,
		threadId: uuidSchema,
		turnId: uuidSchema,
		messageId: uuidSchema,
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("message.completed"),
		sessionId: uuidSchema,
		threadId: uuidSchema,
		turnId: uuidSchema,
		message: threadMessageSchema,
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("tool.started"),
		sessionId: uuidSchema,
		turnId: uuidSchema,
		toolCallId: uuidSchema,
		toolName: z.string().min(1),
		// The tool's arguments, capped server-side. Drives the card's target/args
		// summary on the client. Optional so historical events still parse.
		input: metadataSchema.optional(),
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("tool.completed"),
		sessionId: uuidSchema,
		turnId: uuidSchema,
		toolCallId: uuidSchema,
		// Mirrors tool.started so a completion that arrives without its start (late
		// join / replay gap) can still name the tool. Optional for old events.
		toolName: z.string().min(1).optional(),
		status: z.enum(["completed", "failed"]),
		// The tool's result, capped server-side; `outputTruncated` flags overflow.
		// Drives the expanded card body on the client.
		output: metadataSchema.optional(),
		outputTruncated: z.boolean().optional(),
		index: z.number().int().min(0),
	}),
	z.object({
		// A rolling 3–6 word reasoning summary phrase. Summary-only and ephemeral:
		// never carries the raw reasoning trace, never persisted as a message. The
		// client shows only the latest phrase as the bottom "thinking" line.
		type: z.literal("reasoning.summary"),
		sessionId: uuidSchema,
		turnId: uuidSchema,
		phrase: z.string().min(1),
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("input.requested"),
		sessionId: uuidSchema,
		turnId: uuidSchema.optional(),
		requestId: uuidSchema,
		prompt: z.string().min(1),
		inputSchema: metadataSchema.nullable(),
	}),
	z.object({
		type: z.literal("session.completed"),
		sessionId: uuidSchema,
		threadId: uuidSchema,
		turnId: uuidSchema,
		status: z.enum(["completed", "cancelled", "failed"]),
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("error"),
		sessionId: uuidSchema.optional(),
		code: apiErrorCodeSchema,
		message: z.string().min(1),
	}),
]);

/**
 * Durable transcript of a thread's past turns — the same wire events the live
 * stream emits, read back from the `agent_stream_events` log so a reloaded
 * session renders its tool cards, not just text. Per-token `message.delta`s are
 * coalesced server-side into one segment event per text run (see
 * `collapseSessionHistory`), so the payload scales with tool calls + text
 * segments, not token count. The active (in-flight) turn is excluded — the live
 * stream owns it.
 */
export const threadEventsResponseSchema = z.object({
	events: z.array(threadMessageStreamEventSchema),
});

export const appEventTypeSchema = z.enum([
	"thread.created",
	"thread.updated",
	"turn.admitted",
	"run.started",
	"message.created",
	"message.delta",
	"message.text.completed",
	"message.completed",
	"tool.started",
	"tool.completed",
	"reasoning.summary",
	"input.requested",
	"run.completed",
	"run.failed",
	"artifact.created",
	"notification.updated",
	"reminder.updated",
]);

export const appEventSchema = z.object({
	seq: z.number().int().positive(),
	type: appEventTypeSchema,
	aggregateType: z.string().min(1),
	aggregateId: uuidSchema,
	aggregateSeq: z.number().int(),
	payload: metadataSchema.default({}),
	createdAt: isoDateTimeSchema,
});

export const scheduledSessionStatusSchema = z.enum([
	"cancelled",
	"dispatched",
	"failed",
	"scheduled",
]);

export const scheduledSessionSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	originThreadId: uuidSchema.nullable(),
	sourceEventId: uuidSchema.nullable(),
	captureId: uuidSchema.nullable(),
	notificationIntentId: uuidSchema.nullable(),
	reminderId: uuidSchema.nullable(),
	title: z.string().min(1),
	instructions: z.string().min(1),
	dueAt: isoDateTimeSchema,
	timezone: z.string().nullable(),
	status: scheduledSessionStatusSchema,
	dedupeKey: z.string().nullable(),
	dispatchedThreadId: uuidSchema.nullable(),
	dispatchedSessionId: uuidSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const threadStopResponseSchema = z.object({
	stopped: z.boolean(),
});

export type AgentMessageRole = z.infer<typeof agentMessageRoleSchema>;
export type ThreadType = z.infer<typeof threadTypeSchema>;
export type ThreadOrigin = z.infer<typeof threadOriginSchema>;
export type ThreadStatus = z.infer<typeof threadStatusSchema>;
export type SessionSourceKind = z.infer<typeof sessionSourceKindSchema>;
export type SessionSourceRole = z.infer<typeof sessionSourceRoleSchema>;
export type ChatPermissionMode = z.infer<typeof chatPermissionModeSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionSource = z.infer<typeof sessionSourceSchema>;
export type SessionSourceListResponse = z.infer<typeof sessionSourceListResponseSchema>;
export type SessionArtifactKind = z.infer<typeof sessionArtifactKindSchema>;
export type SessionArtifactStatus = z.infer<typeof sessionArtifactStatusSchema>;
export type SessionArtifact = z.infer<typeof sessionArtifactSchema>;
export type SessionArtifactListResponse = z.infer<typeof sessionArtifactListResponseSchema>;
export type SessionArtifactDetailResponse = z.infer<typeof sessionArtifactDetailResponseSchema>;
export type ArtifactUpdateRequest = z.infer<typeof artifactUpdateRequestSchema>;
export type SessionArtifactSendResponse = z.infer<typeof sessionArtifactSendResponseSchema>;
export type WebSourceKind = z.infer<typeof webSourceKindSchema>;
export type WebSourceStatus = z.infer<typeof webSourceStatusSchema>;
export type WebSource = z.infer<typeof webSourceSchema>;
export type WebSourceListResponse = z.infer<typeof webSourceListResponseSchema>;
export type AgentRunTrigger = z.infer<typeof agentRunTriggerSchema>;
export type ThreadCreateRequest = z.infer<typeof threadCreateRequestSchema>;
export type ThreadPermissionModeUpdateRequest = z.infer<
	typeof threadPermissionModeUpdateRequestSchema
>;
export type ThreadListResponse = z.infer<typeof threadListResponseSchema>;
export type ThreadDetailResponse = z.infer<typeof threadDetailResponseSchema>;
export type AgentAccountPolicy = z.infer<typeof agentAccountPolicySchema>;
export type AgentAccountPolicyUpdateRequest = z.infer<typeof agentAccountPolicyUpdateRequestSchema>;
export type AgentAccountPolicyResponse = z.infer<typeof agentAccountPolicyResponseSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentToolApprovalStatus = z.infer<typeof agentToolApprovalStatusSchema>;
export type AgentToolPermission = z.infer<typeof agentToolPermissionSchema>;
export type AgentToolApproval = z.infer<typeof agentToolApprovalSchema>;
export type AgentToolPermissionUpdateRequest = z.infer<
	typeof agentToolPermissionUpdateRequestSchema
>;
export type AgentToolApprovalDecisionRequest = z.infer<
	typeof agentToolApprovalDecisionRequestSchema
>;
export type AgentToolPermissionListResponse = z.infer<typeof agentToolPermissionListResponseSchema>;
export type AgentToolPermissionActionResponse = z.infer<
	typeof agentToolPermissionActionResponseSchema
>;
export type AgentToolApprovalListResponse = z.infer<typeof agentToolApprovalListResponseSchema>;
export type AgentToolApprovalActionResponse = z.infer<typeof agentToolApprovalActionResponseSchema>;
export type ToolSurface = z.infer<typeof toolSurfaceSchema>;
export type ToolVisibility = z.infer<typeof toolVisibilitySchema>;
export type ToolPolicyMode = z.infer<typeof toolPolicyModeSchema>;
export type ToolUserAvailability = z.infer<typeof toolUserAvailabilitySchema>;
export type ToolCatalogEntry = z.infer<typeof toolCatalogEntrySchema>;
export type ToolCatalogEntryWithAvailability = z.infer<
	typeof toolCatalogEntryWithAvailabilitySchema
>;
export type ToolCatalogResponse = z.infer<typeof toolCatalogResponseSchema>;
export type AttachmentKind = z.infer<typeof attachmentKindSchema>;
export type AttachmentCreate = z.infer<typeof attachmentCreateSchema>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type ThreadMessage = z.infer<typeof threadMessageSchema>;
export type ThreadMessageCreateRequest = z.infer<typeof threadMessageCreateRequestSchema>;
export type ThreadMessageListResponse = z.infer<typeof threadMessageListResponseSchema>;
export type ThreadMessageSendResponse = z.infer<typeof threadMessageSendResponseSchema>;
export type ThreadMessageStreamEvent = z.infer<typeof threadMessageStreamEventSchema>;

export type ThreadEventsResponse = z.infer<typeof threadEventsResponseSchema>;
export type AppEventType = z.infer<typeof appEventTypeSchema>;
export type AppEvent = z.infer<typeof appEventSchema>;
export type ThreadStopResponse = z.infer<typeof threadStopResponseSchema>;
export type ScheduledSessionStatus = z.infer<typeof scheduledSessionStatusSchema>;
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>;

export const sourceProviderSchema = z.enum([
	"google",
	"slack",
	"linear",
	"github",
	"granola",
	"system",
	"telegram",
]);
export const sourceEventTypeSchema = z.enum([
	"gmail.message",
	"calendar.event",
	"slack.message",
	"linear.issue",
	"github.notification",
	"meeting.completed",
	"message.received",
	"reminder.due",
	"capture.processed",
	"system",
]);

export const sourceEventSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	provider: sourceProviderSchema,
	externalEventId: z.string().nullable(),
	eventType: sourceEventTypeSchema.or(z.string().min(1)),
	occurredAt: isoDateTimeSchema,
	title: z.string().nullable(),
	snippet: z.string().nullable(),
	sourceUrl: z.string().url().nullable(),
});

export type SourceProvider = z.infer<typeof sourceProviderSchema>;
export type SourceEventType = z.infer<typeof sourceEventTypeSchema>;
export type SourceEvent = z.infer<typeof sourceEventSchema>;

export const connectionStatusSchema = z.enum([
	"connected",
	"error",
	"not_connected",
	"paused",
	"planned",
	"revoked",
]);

export const connectionHealthStateSchema = z.enum([
	"api_disabled",
	"brain_backlog",
	"brain_failed",
	"connected",
	"connected_idle",
	"error",
	"not_connected",
	"paused",
	"planned",
	"revoked",
	"syncing",
]);

export const connectionHealthSchema = z.object({
	state: connectionHealthStateSchema,
	label: z.string().min(1),
	detail: z.string().min(1).nullable(),
	pendingJobs: z.number().int().nonnegative().default(0),
	runningJobs: z.number().int().nonnegative().default(0),
	failedJobs: z.number().int().nonnegative().default(0),
	embeddingBacklog: z.number().int().nonnegative().default(0),
	extractionBacklog: z.number().int().nonnegative().default(0),
	processedSourceEvents: z.number().int().nonnegative().default(0),
	lastSourceEventAt: isoDateTimeSchema.nullable(),
	lastFailureAt: isoDateTimeSchema.nullable(),
	lastFailure: z.string().min(1).nullable(),
});

export const connectionSchema = z.object({
	connectorAccountId: uuidSchema.nullable().default(null),
	provider: connectionProviderSchema,
	status: connectionStatusSchema,
	displayName: z.string().nullable(),
	email: z.string().email().nullable(),
	scopes: z.array(z.string()).default([]),
	readOnly: z.boolean(),
	supportsConnect: z.boolean(),
	connectedAt: isoDateTimeSchema.nullable(),
	lastSyncAt: isoDateTimeSchema.nullable(),
	health: connectionHealthSchema,
	metadata: metadataSchema.default({}),
});

export const connectionListResponseSchema = z.object({
	connections: z.array(connectionSchema),
});

export const connectionConnectResponseSchema = z.object({
	connectUrl: z.string().url().nullable(),
	connection: connectionSchema,
	message: z.string().nullable(),
	state: z.string().nullable(),
});

// Connect-request body for API-key providers (granola). OAuth providers take
// no body and reply with a connectUrl instead.
export const connectionConnectRequestSchema = z.object({
	apiKey: z.string().trim().min(8).max(512).optional(),
});

export const googleAuthorizationCodeRequestSchema = z.object({
	code: z.string().trim().min(1).max(8192),
});

export const googleAuthorizationCodeResponseSchema = z.object({
	connection: connectionSchema,
});

export const connectionDisconnectResponseSchema = z.object({
	connection: connectionSchema,
	disconnected: z.boolean(),
});

export const connectorMessageSchema = z.object({
	provider: connectionProviderSchema,
	messageId: z.string().min(1),
	threadId: z.string().nullable(),
	subject: z.string().nullable(),
	from: z.string().nullable(),
	receivedAt: isoDateTimeSchema.nullable(),
	snippet: z.string().nullable(),
	bodyPreview: z.string().nullable(),
	bodyMd: z.string().nullable(),
	sourceEvent: sourceEventSchema.nullable(),
	documentPath: z.string().nullable(),
});

export const accountRequestResponseSchema = z.object({
	requestId: uuidSchema,
	status: z.enum(["queued"]),
	type: z.enum(["account.export"]),
});

// Account deletion is synchronous and irreversible — there is no queued request
// to poll, so it answers with a simple ack once the purge completes.
export const accountDeleteResponseSchema = z.object({
	ok: z.boolean(),
});
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>;

// "Connect to your terminal / Claude Code": a freshly-minted, revocable CLI key
// for the signed-in user's own brain. Returned once; the client shows it and
// does not persist it.
export const cliTokenResponseSchema = z.object({
	token: z.string(),
	keyId: z.string(),
});
export type CliTokenResponse = z.infer<typeof cliTokenResponseSchema>;

export const webhookAckResponseSchema = z.object({
	accepted: z.boolean(),
	processed: z.boolean(),
	provider: connectionProviderSchema,
});

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type ConnectionHealthState = z.infer<typeof connectionHealthStateSchema>;
export type ConnectionHealth = z.infer<typeof connectionHealthSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type ConnectionListResponse = z.infer<typeof connectionListResponseSchema>;
export type ConnectionConnectRequest = z.infer<typeof connectionConnectRequestSchema>;
export type ConnectionConnectResponse = z.infer<typeof connectionConnectResponseSchema>;
export type GoogleAuthorizationCodeRequest = z.infer<typeof googleAuthorizationCodeRequestSchema>;
export type GoogleAuthorizationCodeResponse = z.infer<typeof googleAuthorizationCodeResponseSchema>;
export type ConnectionDisconnectResponse = z.infer<typeof connectionDisconnectResponseSchema>;
export type ConnectorMessage = z.infer<typeof connectorMessageSchema>;
export type AccountRequestResponse = z.infer<typeof accountRequestResponseSchema>;
export type WebhookAckResponse = z.infer<typeof webhookAckResponseSchema>;

export const notificationPayloadSchema = z.object({
	intentId: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	category: z.enum(["ai", "reminder", "system"]),
	urgency: z.enum(["low", "normal", "high", "urgent"]),
	title: z.string().min(1).max(160),
	body: z.string().min(1).max(500),
	sourceEventId: uuidSchema.optional(),
	data: metadataSchema.default({}),
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export const notificationChannelSchema = z.enum(["email", "in_app", "push"]);
export const notificationCategorySchema = z.enum(["ai", "reminder", "system"]);
export const notificationUrgencySchema = z.enum(["low", "normal", "high", "urgent"]);
export const notificationIntentStatusSchema = z.enum([
	"approved",
	"failed",
	"pending",
	"sent",
	"suppressed",
]);
export const notificationDeliveryStatusSchema = z.enum([
	"cancelled",
	"delivered",
	"failed",
	"opened",
	"queued",
	"sent",
]);
export const notificationPreferenceSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	channel: notificationChannelSchema,
	eventCategory: z.string().min(1),
	enabled: z.boolean(),
	quietHoursStart: z.string().nullable(),
	quietHoursEnd: z.string().nullable(),
	timezone: z.string().nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const notificationTargetSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("session"),
		sessionId: uuidSchema,
	}),
	z.object({
		kind: z.literal("reminder"),
		reminderId: uuidSchema,
	}),
	z.object({
		artifactId: uuidSchema,
		artifactKind: sessionArtifactKindSchema,
		kind: z.literal("artifact"),
		sessionId: uuidSchema,
	}),
]);

export const notificationIntentSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	sourceEventId: uuidSchema.nullable(),
	originSessionId: uuidSchema.nullable(),
	originAgentRunId: uuidSchema.nullable(),
	originToolCallId: uuidSchema.nullable(),
	target: notificationTargetSchema,
	category: notificationCategorySchema,
	urgency: notificationUrgencySchema,
	title: z.string().min(1),
	body: z.string().min(1),
	dedupeKey: z.string().nullable(),
	status: notificationIntentStatusSchema,
	decisionReason: z.string().nullable(),
	payload: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const notificationDeliverySchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	notificationIntentId: uuidSchema,
	mobileDeviceId: uuidSchema.nullable(),
	channel: notificationChannelSchema,
	status: notificationDeliveryStatusSchema,
	providerMessageId: z.string().nullable(),
	error: z.string().nullable(),
	sentAt: isoDateTimeSchema.nullable(),
	deliveredAt: isoDateTimeSchema.nullable(),
	openedAt: isoDateTimeSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const notificationListResponseSchema = z.object({
	notifications: z.array(notificationIntentSchema),
	pagination: paginationResponseSchema,
});

export const notificationDetailResponseSchema = z.object({
	deliveries: z.array(notificationDeliverySchema).default([]),
	notification: notificationIntentSchema,
	sourceEvent: sourceEventSchema.nullable().optional(),
	target: notificationTargetSchema,
});

export const notificationActionResponseSchema = z.object({
	notification: notificationIntentSchema,
	target: notificationTargetSchema,
});

export const notificationSnoozeRequestSchema = z.object({
	snoozedUntil: isoDateTimeSchema,
});

export const notificationPreferenceListResponseSchema = z.object({
	preferences: z.array(notificationPreferenceSchema),
});

export const notificationPreferenceUpdateRequestSchema = z
	.object({
		channel: notificationChannelSchema.default("push"),
		enabled: z.boolean().optional(),
		eventCategory: z.string().trim().min(1).max(80).default("all"),
		metadata: metadataSchema.optional(),
		quietHoursEnd: z.string().trim().min(4).max(8).nullable().optional(),
		quietHoursStart: z.string().trim().min(4).max(8).nullable().optional(),
		timezone: z.string().trim().min(1).max(120).nullable().optional(),
	})
	.refine(
		(value) =>
			value.enabled !== undefined ||
			value.metadata !== undefined ||
			value.quietHoursEnd !== undefined ||
			value.quietHoursStart !== undefined ||
			value.timezone !== undefined,
		{
			message: "At least one notification preference field must be provided.",
		},
	);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type NotificationUrgency = z.infer<typeof notificationUrgencySchema>;
export type NotificationIntentStatus = z.infer<typeof notificationIntentStatusSchema>;
export type NotificationDeliveryStatus = z.infer<typeof notificationDeliveryStatusSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;
export type NotificationIntent = z.infer<typeof notificationIntentSchema>;
export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type NotificationDetailResponse = z.infer<typeof notificationDetailResponseSchema>;
export type NotificationActionResponse = z.infer<typeof notificationActionResponseSchema>;
export type NotificationSnoozeRequest = z.infer<typeof notificationSnoozeRequestSchema>;
export type NotificationPreferenceListResponse = z.infer<
	typeof notificationPreferenceListResponseSchema
>;
export type NotificationPreferenceUpdateRequest = z.infer<
	typeof notificationPreferenceUpdateRequestSchema
>;

export const reminderStatusSchema = z.enum(["scheduled", "sent", "snoozed", "cancelled", "failed"]);

export const reminderSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	sourceEventId: uuidSchema.nullable(),
	captureId: uuidSchema.nullable(),
	title: z.string().min(1),
	body: z.string().nullable(),
	dueAt: isoDateTimeSchema,
	timezone: z.string().nullable(),
	status: reminderStatusSchema,
	snoozedUntil: isoDateTimeSchema.nullable(),
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const reminderCreateRequestSchema = z.object({
	sourceEventId: uuidSchema.optional(),
	captureId: uuidSchema.optional(),
	title: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(1000).optional(),
	dueAt: isoDateTimeSchema,
	timezone: z.string().trim().min(1).max(120).optional(),
	metadata: metadataSchema.default({}),
});

export const reminderUpdateRequestSchema = z
	.object({
		title: z.string().trim().min(1).max(200).optional(),
		body: z.string().trim().min(1).max(1000).nullable().optional(),
		dueAt: isoDateTimeSchema.optional(),
		timezone: z.string().trim().min(1).max(120).nullable().optional(),
		status: reminderStatusSchema.optional(),
		snoozedUntil: isoDateTimeSchema.nullable().optional(),
		metadata: metadataSchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one reminder field must be provided.",
	});

export const reminderSnoozeRequestSchema = z.object({
	snoozedUntil: isoDateTimeSchema,
});

export const reminderActionResponseSchema = z.object({
	reminder: reminderSchema,
});

export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderCreateRequest = z.infer<typeof reminderCreateRequestSchema>;
export type ReminderUpdateRequest = z.infer<typeof reminderUpdateRequestSchema>;
export type ReminderSnoozeRequest = z.infer<typeof reminderSnoozeRequestSchema>;
export type ReminderActionResponse = z.infer<typeof reminderActionResponseSchema>;

export const reminderListResponseSchema = z.object({
	pagination: paginationResponseSchema,
	reminders: z.array(reminderSchema),
});

export const reminderDetailResponseSchema = z.object({
	reminder: reminderSchema,
});

export type ReminderListResponse = z.infer<typeof reminderListResponseSchema>;
export type ReminderDetailResponse = z.infer<typeof reminderDetailResponseSchema>;

export const homeSectionIdSchema = z.enum(["notifications", "ready_for_review", "reminders"]);
export const homeFeedItemKindSchema = z.enum(["notification", "reminder", "session_review"]);
export const homeFeedActionSchema = z.enum(["complete", "disable", "dismiss", "open", "snooze"]);
export const homeFeedTargetSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("notification"),
		notificationId: uuidSchema,
	}),
	z.object({
		kind: z.literal("reminder"),
		reminderId: uuidSchema,
	}),
	z.object({
		kind: z.literal("session"),
		sessionId: uuidSchema,
	}),
]);

export const homeFeedItemSchema = z.object({
	id: z.string().min(1),
	actions: z.array(homeFeedActionSchema).default([]),
	body: z.string().nullable().optional(),
	icon: z.string().min(1),
	kind: homeFeedItemKindSchema,
	occurredAt: isoDateTimeSchema,
	sourceLabel: z.string().nullable().optional(),
	target: homeFeedTargetSchema,
	title: z.string().min(1),
	unread: z.boolean().default(false),
	urgency: notificationUrgencySchema.optional(),
});

export const homeSectionSchema = z.object({
	id: homeSectionIdSchema,
	items: z.array(homeFeedItemSchema),
	nextCursor: z.string().min(1).nullable().default(null),
	title: z.string().min(1),
	totalCount: z.number().int().nonnegative(),
	updatedAt: isoDateTimeSchema.nullable().default(null),
});

export const homeResponseSchema = z.object({
	sections: z.array(homeSectionSchema),
});

export const homeSectionResponseSchema = z.object({
	section: homeSectionSchema,
});

export type HomeSectionId = z.infer<typeof homeSectionIdSchema>;
export type HomeFeedItemKind = z.infer<typeof homeFeedItemKindSchema>;
export type HomeFeedAction = z.infer<typeof homeFeedActionSchema>;
export type HomeFeedTarget = z.infer<typeof homeFeedTargetSchema>;
export type HomeFeedItem = z.infer<typeof homeFeedItemSchema>;
export type HomeSection = z.infer<typeof homeSectionSchema>;
export type HomeResponse = z.infer<typeof homeResponseSchema>;
export type HomeSectionResponse = z.infer<typeof homeSectionResponseSchema>;

export const brainSearchRequestSchema = z.object({
	limit: z.coerce.number().int().min(1).max(25).default(10),
	q: z.string().trim().min(1).max(500),
});

export const brainSearchHitSchema = z.object({
	bodyPreview: z.string(),
	embeddingScore: z.number().nullable(),
	id: uuidSchema,
	kind: z.enum([
		"agent_action",
		"fact",
		"index",
		"log",
		"note",
		"raw",
		"search_result",
		"wiki_page",
	]),
	path: z.string().min(1),
	score: z.number(),
	sourceKind: z.string().nullable(),
	sourceRef: z.string().nullable(),
	textScore: z.number(),
	title: z.string().nullable(),
	tldr: z.string().nullable(),
	updatedAt: isoDateTimeSchema,
});

export const brainSearchResponseSchema = z.object({
	limit: z.number().int().min(1).max(25),
	q: z.string().min(1),
	results: z.array(brainSearchHitSchema),
});

export type BrainSearchRequest = z.infer<typeof brainSearchRequestSchema>;
export type BrainSearchHit = z.infer<typeof brainSearchHitSchema>;
export type BrainSearchResponse = z.infer<typeof brainSearchResponseSchema>;
