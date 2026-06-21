// catalog: API-012
import { describe, expect, test } from "bun:test";

import {
	agentToolApprovalDecisionRequestSchema,
	agentToolApprovalSchema,
	agentToolPermissionSchema,
	agentToolPermissionUpdateRequestSchema,
	apiErrorResponseSchema,
	appEventSchema,
	automationAccountScopeSchema,
	automationCompositionRequestSchema,
	automationCreateRequestSchema,
	automationInvocationEventSchema,
	automationInvocationSchema,
	automationRunDetailResponseSchema,
	automationRunSummarySchema,
	automationSchema,
	automationSettingsSchemaSchema,
	automationTemplateSchema,
	automationUpdateRequestSchema,
	automationWebhookActionResponseSchema,
	automationWebhookReceiveResponseSchema,
	automationWebhookUpdateRequestSchema,
	bootstrapResponseSchema,
	brainSearchResponseSchema,
	captureAudioStartRequestSchema,
	captureTranscriptRequestSchema,
	captureTranscriptResponseSchema,
	connectionConnectResponseSchema,
	connectionListResponseSchema,
	connectorMessageSchema,
	createHealthzResponse,
	deviceRegistrationRequestSchema,
	healthzResponseSchema,
	notificationActionResponseSchema,
	notificationDetailResponseSchema,
	notificationPreferenceUpdateRequestSchema,
	scheduledSessionSchema,
	sessionArtifactSchema,
	sessionSourceSchema,
	threadMessageCreateRequestSchema,
	threadMessageStreamEventSchema,
	toolCatalogResponseSchema,
} from "./index";

describe("contracts", () => {
	test("creates a valid health response", () => {
		const response = createHealthzResponse("api", new Date("2026-06-05T00:00:00.000Z"));

		expect(healthzResponseSchema.safeParse(response).success).toBe(true);
	});

	test("validates shared mobile API contracts", () => {
		expect(
			apiErrorResponseSchema.safeParse({
				error: {
					code: "unauthorized",
					message: "Authentication is required.",
					requestId: "request-1",
				},
			}).success,
		).toBe(true);
		expect(
			deviceRegistrationRequestSchema.safeParse({
				deviceInstallId: "install-1",
				platform: "ios",
				pushTokenProvider: "expo",
			}).success,
		).toBe(true);
		expect(
			threadMessageStreamEventSchema.safeParse({
				type: "message.delta",
				sessionId: "11111111-1111-4111-8111-111111111111",
				threadId: "22222222-2222-4222-8222-222222222222",
				turnId: "44444444-4444-4444-8444-444444444444",
				messageId: "33333333-3333-4333-8333-333333333333",
				delta: "hello",
				index: 0,
			}).success,
		).toBe(true);
		expect(
			threadMessageStreamEventSchema.safeParse({
				type: "message.text.completed",
				sessionId: "11111111-1111-4111-8111-111111111111",
				threadId: "22222222-2222-4222-8222-222222222222",
				turnId: "44444444-4444-4444-8444-444444444444",
				messageId: "33333333-3333-4333-8333-333333333333",
				index: 1,
			}).success,
		).toBe(true);
		expect(
			appEventSchema.safeParse({
				seq: 1,
				type: "message.delta",
				aggregateType: "agent_run",
				aggregateId: "11111111-1111-4111-8111-111111111111",
				aggregateSeq: 0,
				payload: {
					delta: "hello",
					messageId: "33333333-3333-4333-8333-333333333333",
					threadId: "22222222-2222-4222-8222-222222222222",
					turnId: "44444444-4444-4444-8444-444444444444",
				},
				createdAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			appEventSchema.safeParse({
				seq: 2,
				type: "message.text.completed",
				aggregateType: "agent_run",
				aggregateId: "11111111-1111-4111-8111-111111111111",
				aggregateSeq: 1,
				payload: {
					messageId: "33333333-3333-4333-8333-333333333333",
					threadId: "22222222-2222-4222-8222-222222222222",
					turnId: "44444444-4444-4444-8444-444444444444",
				},
				createdAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			threadMessageCreateRequestSchema.safeParse({
				attachments: [
					{
						height: 768,
						kind: "image",
						mimeType: "image/jpeg",
						sizeBytes: 123456,
						storagePath: "11111111-1111-4111-8111-111111111111/thread/image.jpg",
						width: 1024,
					},
				],
			}).success,
		).toBe(true);
		expect(
			brainSearchResponseSchema.safeParse({
				limit: 5,
				q: "phase 3",
				results: [
					{
						bodyPreview: "Phase 3 memory result",
						embeddingScore: 0.8,
						id: "55555555-5555-4555-8555-555555555555",
						kind: "raw",
						path: "/private/sources/voice/2026/06/05/phase-3.md",
						score: 1.2,
						sourceKind: "capture",
						sourceRef: "phase-3",
						textScore: 0.4,
						title: "Phase 3",
						tldr: "Phase 3 memory result",
						updatedAt: "2026-06-05T00:00:00.000Z",
					},
				],
			}).success,
		).toBe(true);
		expect(
			connectionListResponseSchema.safeParse({
				connections: [
					{
						provider: "google",
						status: "connected",
						displayName: "Raf",
						email: "raf@example.com",
						scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
						readOnly: true,
						supportsConnect: true,
						connectedAt: "2026-06-05T00:00:00.000Z",
						lastSyncAt: null,
						health: {
							detail: null,
							embeddingBacklog: 0,
							extractionBacklog: 0,
							failedJobs: 0,
							label: "Connected",
							lastFailure: null,
							lastFailureAt: null,
							lastSourceEventAt: null,
							pendingJobs: 0,
							processedSourceEvents: 0,
							runningJobs: 0,
							state: "connected",
						},
						metadata: { phase: 9 },
					},
				],
			}).success,
		).toBe(true);
		expect(
			connectionConnectResponseSchema.safeParse({
				connectUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
				connection: {
					provider: "google",
					status: "not_connected",
					displayName: null,
					email: null,
					scopes: [],
					readOnly: true,
					supportsConnect: true,
					connectedAt: null,
					lastSyncAt: null,
					health: {
						detail: "Connect Google to start Gmail sync.",
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
					metadata: { phase: 9 },
				},
				message: "Open this URL to connect Google workspace access.",
				state: "state",
			}).success,
		).toBe(true);
		expect(
			connectorMessageSchema.safeParse({
				provider: "google",
				messageId: "msg-1",
				threadId: "thread-1",
				subject: "Production down",
				from: "ops@example.com",
				receivedAt: "2026-06-05T00:00:00.000Z",
				snippet: "Action required.",
				bodyPreview: "Action required.",
				bodyMd: "Action required.",
				sourceEvent: null,
				documentPath: "/private/sources/google/gmail/gmail-msg-1.md",
			}).success,
		).toBe(true);
		expect(
			sessionSourceSchema.safeParse({
				id: "15151515-1515-4515-9515-151515151515",
				tenantId: "22222222-2222-4222-8222-222222222222",
				userId: "11111111-1111-4111-8111-111111111111",
				threadId: "66666666-6666-4666-8666-666666666666",
				sourceKind: "source_event",
				sourceId: "34343434-3434-4343-8343-343434343434",
				role: "primary",
				snapshot: { title: "Production down" },
				metadata: { source: "email.route" },
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			sessionArtifactSchema.safeParse({
				id: "16161616-1616-4616-8616-161616161616",
				tenantId: "22222222-2222-4222-8222-222222222222",
				userId: "11111111-1111-4111-8111-111111111111",
				sessionId: "66666666-6666-4666-8666-666666666666",
				agentRunId: null,
				toolCallId: null,
				artifactKind: "email_draft",
				title: "Re: Production down",
				status: "active",
				payload: { subject: "Re: Production down" },
				metadata: {},
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			captureAudioStartRequestSchema.safeParse({
				clientCaptureId: "local-voice-1",
				mode: "press_hold",
				timezone: "Europe/Amsterdam",
			}).success,
		).toBe(true);
		expect(
			captureTranscriptRequestSchema.safeParse({
				clientCaptureId: "local-voice-1",
				durationMs: 2500,
				segments: [{ index: 0, text: "Remember to follow up with Sam tomorrow." }],
				transcript: "Remember to follow up with Sam tomorrow.",
			}).success,
		).toBe(true);
		expect(
			captureTranscriptResponseSchema.safeParse({
				captureId: "11111111-1111-4111-8111-111111111111",
				finalized: false,
				segments: [{ index: 0, text: "We decided Sam owns the follow-up." }],
				transcript: "We decided Sam owns the follow-up.",
			}).success,
		).toBe(true);
		expect(
			scheduledSessionSchema.safeParse({
				id: "12121212-1212-4121-8121-121212121212",
				tenantId: "22222222-2222-4222-8222-222222222222",
				userId: "11111111-1111-4111-8111-111111111111",
				originThreadId: "33333333-3333-4333-8333-333333333333",
				sourceEventId: null,
				captureId: null,
				notificationIntentId: null,
				reminderId: null,
				title: "Draft reply",
				instructions: "Draft the reply and notify me when it is ready.",
				dueAt: "2026-06-09T08:00:00.000Z",
				timezone: "Europe/Amsterdam",
				status: "scheduled",
				dedupeKey: "scheduled:test",
				dispatchedThreadId: null,
				dispatchedSessionId: null,
				metadata: {},
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			notificationDetailResponseSchema.safeParse({
				deliveries: [
					{
						id: "88888888-8888-4888-8888-888888888888",
						tenantId: "22222222-2222-4222-8222-222222222222",
						userId: "11111111-1111-4111-8111-111111111111",
						notificationIntentId: "99999999-9999-4999-8999-999999999999",
						mobileDeviceId: null,
						channel: "push",
						status: "sent",
						providerMessageId: "ticket-1",
						error: null,
						sentAt: "2026-06-05T00:00:00.000Z",
						deliveredAt: null,
						openedAt: null,
						metadata: {},
						createdAt: "2026-06-05T00:00:00.000Z",
						updatedAt: "2026-06-05T00:00:00.000Z",
					},
				],
				notification: {
					id: "99999999-9999-4999-8999-999999999999",
					tenantId: "22222222-2222-4222-8222-222222222222",
					userId: "11111111-1111-4111-8111-111111111111",
					sourceEventId: null,
					originSessionId: null,
					originAgentRunId: null,
					originToolCallId: null,
					target: {
						kind: "reminder",
						reminderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
					},
					category: "reminder",
					urgency: "normal",
					title: "Reminder due",
					body: "Open Unison to view it.",
					dedupeKey: "reminder.due:test",
					status: "sent",
					decisionReason: "Reminder due now.",
					payload: {},
					createdAt: "2026-06-05T00:00:00.000Z",
					updatedAt: "2026-06-05T00:00:00.000Z",
				},
				target: {
					kind: "reminder",
					reminderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
				},
			}).success,
		).toBe(true);
		expect(
			notificationActionResponseSchema.safeParse({
				notification: {
					id: "99999999-9999-4999-8999-999999999999",
					tenantId: "22222222-2222-4222-8222-222222222222",
					userId: "11111111-1111-4111-8111-111111111111",
					sourceEventId: null,
					originSessionId: null,
					originAgentRunId: null,
					originToolCallId: null,
					target: {
						kind: "session",
						sessionId: "66666666-6666-4666-8666-666666666666",
					},
					category: "system",
					urgency: "low",
					title: "Preference saved",
					body: "Notification preference saved.",
					dedupeKey: null,
					status: "suppressed",
					decisionReason: "Dismissed by user.",
					payload: {},
					createdAt: "2026-06-05T00:00:00.000Z",
					updatedAt: "2026-06-05T00:00:00.000Z",
				},
				target: {
					kind: "session",
					sessionId: "66666666-6666-4666-8666-666666666666",
				},
			}).success,
		).toBe(true);
		expect(
			notificationPreferenceUpdateRequestSchema.safeParse({
				enabled: false,
				quietHoursEnd: "07:00",
				quietHoursStart: "22:00",
			}).success,
		).toBe(true);
	});

	test("validates bootstrap responses", () => {
		expect(
			bootstrapResponseSchema.safeParse({
				auth: {
					userId: "11111111-1111-4111-8111-111111111111",
					profileId: "11111111-1111-4111-8111-111111111111",
					tenantId: "22222222-2222-4222-8222-222222222222",
				},
				profile: {
					id: "11111111-1111-4111-8111-111111111111",
					email: "mobile@unison.local",
					displayName: "Mobile User",
					avatarUrl: null,
					createdAt: "2026-06-05T00:00:00.000Z",
					updatedAt: "2026-06-05T00:00:00.000Z",
				},
				tenant: {
					id: "22222222-2222-4222-8222-222222222222",
					displayName: "Mobile User's brain",
					status: "active",
					role: "owner",
					isDefault: true,
					createdAt: "2026-06-05T00:00:00.000Z",
					updatedAt: "2026-06-05T00:00:00.000Z",
				},
				brainInitStatus: "queued",
				featureFlags: {
					capture: true,
					chat: true,
					connectors: true,
					notifications: true,
					rawAudioUpload: false,
				},
				recommendedNextAction: "register_device",
			}).success,
		).toBe(true);
	});

	test("accepts a valid automation create payload", () => {
		expect(
			automationCreateRequestSchema.safeParse({
				templateKey: "daily-capture-digest",
				name: "My digest",
				settingsValues: { hour: 8 },
				enabled: true,
			}).success,
		).toBe(true);
	});

	test("accepts a custom automation create payload", () => {
		const parsed = automationCreateRequestSchema.safeParse({
			kind: "custom",
			name: "Custom briefing",
			mode: "read_only",
			systemPrompt: "Summarize recent context.",
			triggers: [{ triggerType: "manual" }],
			toolBindings: [{ toolName: "brain.search" }],
		});

		expect(parsed.success).toBe(true);
		if (parsed.success && parsed.data.kind === "custom") {
			expect(parsed.data.status).toBe("enabled");
			expect(parsed.data.toolBindings[0]?.enabled).toBe(true);
			expect(parsed.data.toolBindings[0]?.sideEffectClass).toBe("read");
		}
	});

	test("rejects a custom automation create payload without a system prompt or enabled tools", () => {
		expect(
			automationCreateRequestSchema.safeParse({
				kind: "custom",
				name: "Custom briefing",
				mode: "read_only",
				triggers: [{ triggerType: "manual" }],
				toolBindings: [{ enabled: false, toolName: "brain.search" }],
			}).success,
		).toBe(false);
	});

	test("rejects an automation create payload without a template", () => {
		expect(automationCreateRequestSchema.safeParse({ name: "x" }).success).toBe(false);
	});

	test("rejects an empty automation update payload", () => {
		expect(automationUpdateRequestSchema.safeParse({}).success).toBe(false);
	});

	test("rejects an invalid automation mode", () => {
		expect(automationUpdateRequestSchema.safeParse({ mode: "full_access" }).success).toBe(false);
	});

	test("validates structured automation account scope primitives", () => {
		expect(automationAccountScopeSchema.parse({})).toEqual({
			allowWebhookAccountOverride: false,
			toolAccounts: "primary_account",
			triggerAccounts: "all",
		});
		expect(
			automationAccountScopeSchema.safeParse({
				allowWebhookAccountOverride: true,
				toolAccounts: "trigger_account",
				triggerAccounts: {
					accountIds: ["11111111-1111-4111-8111-111111111111"],
					provider: "google",
				},
			}).success,
		).toBe(true);
		expect(
			automationAccountScopeSchema.safeParse({
				toolAccounts: {
					accountIds: ["not-a-uuid"],
					provider: "google",
				},
			}).success,
		).toBe(false);
	});

	test("validates rich automation settings field primitives", () => {
		expect(
			automationSettingsSchemaSchema.safeParse({
				version: 1,
				sections: [{ key: "routing", label: "Routing" }],
				fields: [
					{ key: "url", label: "URL", type: "url", sectionKey: "routing" },
					{ key: "accent", label: "Accent", type: "color" },
					{ key: "days", label: "Days", type: "day_of_week", config: { multiple: true } },
					{ key: "lookback", label: "Lookback", type: "relative_duration" },
					{ key: "accounts", label: "Accounts", type: "account_picker" },
					{ key: "providers", label: "Providers", type: "integration_picker" },
					{ key: "toolsets", label: "Toolsets", type: "toolset_picker" },
					{ key: "outputs", label: "Outputs", type: "output_destination" },
					{ key: "rules", label: "Rules", type: "repeated_object" },
					{ key: "tags", label: "Tags", type: "chip_list" },
				],
			}).success,
		).toBe(true);
	});

	test("validates callable automation contracts", () => {
		const parentId = "11111111-1111-4111-8111-111111111111";
		const childId = "22222222-2222-4222-8222-222222222222";
		const invocationId = "33333333-3333-4333-8333-333333333333";
		expect(
			automationUpdateRequestSchema.safeParse({
				callableAutomationIds: [childId],
			}).success,
		).toBe(true);
		expect(
			automationSchema.safeParse({
				id: parentId,
				tenantId: "44444444-4444-4444-8444-444444444444",
				userId: "55555555-5555-4555-8555-555555555555",
				templateKey: null,
				templateVersion: 1,
				version: 1,
				name: "Parent",
				description: null,
				status: "enabled",
				mode: "autonomous",
				templateSnapshot: {},
				settingsSchema: { version: 1, sections: [], fields: [] },
				settingsValues: {},
				systemPrompt: null,
				outputContracts: [],
				integrationRequirements: [],
				callableAutomationIds: [childId],
				accountScope: {},
				metadata: {},
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			automationInvocationSchema.safeParse({
				id: invocationId,
				tenantId: "44444444-4444-4444-8444-444444444444",
				userId: "55555555-5555-4555-8555-555555555555",
				automationId: childId,
				sessionId: null,
				agentRunId: null,
				triggerId: null,
				triggerEventId: null,
				triggerType: "automation_call",
				logicalTriggerType: "automation.call",
				parentInvocationId: "66666666-6666-4666-8666-666666666666",
				callDepth: 1,
				callChain: [parentId, childId],
				status: "pending",
				input: {},
				sourceAnchor: {},
				dedupeKey: null,
				compiledPromptHash: null,
				runSummary: null,
				errorSummary: null,
				startedAt: null,
				finishedAt: null,
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
	});

	test("validates automation composition tool request contracts", () => {
		const automationId = "11111111-1111-4111-8111-111111111111";
		expect(
			automationCompositionRequestSchema.safeParse({
				operation: "automation.list",
				callableOnly: true,
				enabled: true,
				query: "invoice",
			}).success,
		).toBe(true);
		expect(
			automationCompositionRequestSchema.safeParse({
				operation: "automation.update",
				surface: "chat",
				automationId,
				fields: { name: "Invoice watcher" },
				tools: {
					add: [{ toolName: "brain.search" }],
					remove: ["notification.create"],
				},
				triggers: {
					add: [{ triggerType: "automation_call" }],
					disable: ["22222222-2222-4222-8222-222222222222"],
				},
			}).success,
		).toBe(true);
		expect(
			automationCompositionRequestSchema.safeParse({
				operation: "automation.test",
				automationId,
				request: {
					sourceEventId: "33333333-3333-4333-8333-333333333333",
				},
			}).success,
		).toBe(true);
		expect(
			automationCompositionRequestSchema.safeParse({
				operation: "automation.test",
				automationId,
				request: {
					input: { invoiceId: "inv-1" },
					sourceEventId: "33333333-3333-4333-8333-333333333333",
				},
			}).success,
		).toBe(false);
		expect(
			automationCompositionRequestSchema.safeParse({
				operation: "automation.update",
				automationId,
			}).success,
		).toBe(false);
	});

	test("validates automation webhook contracts", () => {
		expect(
			automationWebhookUpdateRequestSchema.safeParse({
				enabled: true,
				rotateSecret: true,
			}).success,
		).toBe(true);
		expect(automationWebhookUpdateRequestSchema.safeParse({}).success).toBe(false);
		expect(
			automationWebhookActionResponseSchema.safeParse({
				secret: "whsec_once",
				webhook: {
					id: "20202020-2020-4020-8020-202020202020",
					automationId: "21212121-2121-4121-8121-212121212121",
					enabled: true,
					defaultAccountScope: {},
					allowAccountOverride: false,
					urlPath: "/webhooks/automations/20202020-2020-4020-8020-202020202020",
					createdAt: "2026-06-05T00:00:00.000Z",
					updatedAt: "2026-06-05T00:00:00.000Z",
				},
			}).success,
		).toBe(true);
		expect(
			automationWebhookReceiveResponseSchema.safeParse({
				accepted: true,
				processed: false,
				sourceEventId: "22222222-2222-4222-8222-222222222222",
			}).success,
		).toBe(true);
	});

	test("validates incomplete automation run summaries", () => {
		expect(
			automationRunSummarySchema.safeParse({
				status: "incomplete",
				title: "Meeting briefing",
				preview: "Missing required output: Meeting briefing artifact.",
				toolCallCount: 2,
				approvalCount: 0,
				artifactCount: 0,
				notificationCount: 0,
				sourceLinks: [],
				errorSummary: "Missing required output: Meeting briefing artifact.",
				lastEventAt: "2026-06-05T00:00:00.000Z",
				metadata: {
					outputContracts: {
						missingRequired: [
							{
								evidence: null,
								kind: "document",
								label: "Meeting briefing artifact",
								required: true,
								satisfied: false,
							},
						],
					},
				},
			}).success,
		).toBe(true);
		expect(
			automationInvocationEventSchema.safeParse({
				id: "23232323-2323-4323-8323-232323232323",
				tenantId: "22222222-2222-4222-8222-222222222222",
				userId: "11111111-1111-4111-8111-111111111111",
				automationId: "24242424-2424-4424-8424-242424242424",
				invocationId: "25252525-2525-4525-8525-252525252525",
				eventType: "session.dispatched",
				severity: "info",
				title: "Automation session started",
				message: null,
				metadata: { compiledPromptHash: "abc123" },
				createdAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(automationRunDetailResponseSchema.shape.events.safeParse(undefined).success).toBe(true);
	});

	test("validates agent tool permission and approval contracts", () => {
		const ids = {
			approvalId: "18181818-1818-4818-9818-181818181818",
			sessionId: "77777777-7777-4777-8777-777777777777",
			tenantId: "22222222-2222-4222-8222-222222222222",
			toolCallId: "19191919-1919-4919-9919-191919191919",
			toolPermissionId: "17171717-1717-4717-9717-171717171717",
			userId: "11111111-1111-4111-8111-111111111111",
		};

		expect(
			agentToolPermissionSchema.safeParse({
				id: ids.toolPermissionId,
				tenantId: ids.tenantId,
				userId: ids.userId,
				toolName: "notification.create",
				permission: "ask_for_approval",
				metadata: {},
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			agentToolApprovalSchema.safeParse({
				id: ids.approvalId,
				tenantId: ids.tenantId,
				userId: ids.userId,
				sessionId: ids.sessionId,
				toolCallId: ids.toolCallId,
				toolName: "notification.create",
				status: "pending",
				input: { title: "Draft ready" },
				requestedReason: "Tool requires approval.",
				decisionNote: null,
				decidedAt: null,
				expiresAt: null,
				metadata: {},
				createdAt: "2026-06-05T00:00:00.000Z",
				updatedAt: "2026-06-05T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			agentToolPermissionUpdateRequestSchema.safeParse({ permission: "always_reject" }).success,
		).toBe(true);
		expect(agentToolApprovalDecisionRequestSchema.safeParse({ decision: "maybe" }).success).toBe(
			false,
		);
	});

	test("validates tool catalog responses with availability and surfaces", () => {
		expect(
			toolCatalogResponseSchema.safeParse({
				tools: [
					{
						availability: "available",
						category: "capture",
						defaultPermission: "always_allow",
						description: "Read the triggering source event.",
						displayGroup: null,
						name: "sourceEvent.get",
						origin: "engine",
						parameters: { type: "object" },
						policyMode: "fixed",
						requiredConnection: null,
						requiredScopes: [],
						sideEffectClass: "read",
						surfaces: ["automation", "anchored"],
						title: "Get source event",
						toolsetId: "capture",
						userAvailability: {
							healthy: true,
							missingScopes: [],
							provider: null,
							reason: null,
							required: false,
							status: "healthy",
						},
						visibility: "hidden",
					},
				],
			}).success,
		).toBe(true);
		expect(
			toolCatalogResponseSchema.safeParse({
				tools: [{ surfaces: ["not_a_surface"] }],
			}).success,
		).toBe(false);
	});

	test("validates a stock automation template shape", () => {
		expect(
			automationTemplateSchema.safeParse({
				key: "daily-capture-digest",
				version: 1,
				name: "Daily Capture Digest",
				description: "Digest of recent captures.",
				category: "internal",
				mode: "autonomous",
				systemPrompt: "Summarize the last 24 hours of captures.",
				status: "available",
				tools: ["capture.listRecent", "notification.create"],
				triggers: [{ triggerType: "schedule", config: { frequency: "daily", hour: 8 } }],
				preferenceFields: [
					{ key: "hour", label: "Send hour", type: "number", required: false, default: 8 },
				],
				defaultPreferences: { hour: 8 },
				settingsSchema: {
					version: 1,
					sections: [{ key: "schedule", label: "Schedule" }],
					fields: [
						{
							key: "hour",
							label: "Send hour",
							type: "number",
							sectionKey: "schedule",
							required: false,
							default: 8,
						},
					],
				},
				defaultSettings: { hour: 8 },
				outputContracts: [
					{ kind: "session_reply", label: "Session summary", required: true, config: {} },
				],
				integrationRequirements: [],
				toolGroups: [],
				available: true,
			}).success,
		).toBe(true);
	});
});
