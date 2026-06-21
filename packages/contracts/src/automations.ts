import { z } from "zod";

import {
	agentToolPermissionDecisionSchema,
	agentToolSideEffectClassSchema,
	connectionProviderSchema,
	executionModeSchema,
	isoDateTimeSchema,
	metadataSchema,
	paginationRequestSchema,
	paginationResponseSchema,
	uuidSchema,
} from "./shared";

// ===========================================================================
// Automations
//
// An automation is a saved CONFIGURATION for starting an agent session:
// trigger + system prompt + allowed agent tools + permission policy + source
// bindings + typed settings. It never executes work itself. A trigger firing only
// creates a thin invocation ledger row plus a session + agent run that the
// normal agent runtime drives. Tool bindings reference agent runtime tool
// names (MobileAgentToolName); permission overrides reuse the shared agent tool
// permission policy.
// ===========================================================================

export const automationStatusSchema = z.enum(["enabled", "disabled", "archived"]);
export const automationModeSchema = executionModeSchema;
export const automationTriggerTypeSchema = z.enum([
	"manual",
	"automation_call",
	"schedule",
	"source_event",
	"gmail",
	"calendar",
	"capture",
	"webhook",
	"meeting",
]);
// Invocation status is dispatch-shaped: the session/agent run owns execution
// detail, so the ledger only tracks whether the session was started.
export const automationInvocationStatusSchema = z.enum([
	"pending",
	"dispatched",
	"skipped",
	"failed",
]);
export const automationRunSummaryStatusSchema = z.enum([
	"pending",
	"dispatched",
	"running",
	"approval_needed",
	"completed",
	"incomplete",
	"failed",
	"skipped",
]);

export type AutomationStatus = z.infer<typeof automationStatusSchema>;
export type AutomationMode = z.infer<typeof automationModeSchema>;
export type AutomationTriggerType = z.infer<typeof automationTriggerTypeSchema>;
export type AutomationInvocationStatus = z.infer<typeof automationInvocationStatusSchema>;
export type AutomationToolSideEffectClass = z.infer<typeof agentToolSideEffectClassSchema>;
export type AutomationRunSummaryStatus = z.infer<typeof automationRunSummaryStatusSchema>;

export const automationSettingOptionSchema = z.object({
	value: z.string().min(1),
	label: z.string().min(1),
	description: z.string().optional(),
});

export const automationSettingFieldTypeSchema = z.enum([
	"text",
	"string",
	"textarea",
	"number",
	"boolean",
	"select",
	"multi_select",
	"chip_list",
	"string_list",
	"repeated_object",
	"time",
	"day_of_week",
	"relative_duration",
	"timezone",
	"url",
	"color",
	"account_picker",
	"integration_picker",
	"toolset_picker",
	"output_destination",
	"json",
]);

export const automationSettingFieldSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	type: automationSettingFieldTypeSchema,
	sectionKey: z.string().min(1).optional(),
	description: z.string().optional(),
	required: z.boolean().default(false),
	default: z.unknown().optional(),
	placeholder: z.string().optional(),
	options: z.array(automationSettingOptionSchema).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().positive().optional(),
	advanced: z.boolean().default(false),
	config: metadataSchema.default({}),
});

export const automationSettingsSectionSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	description: z.string().optional(),
	order: z.number().int().optional(),
});

export const automationSettingsSchemaSchema = z.object({
	version: z.number().int().positive().default(1),
	sections: z.array(automationSettingsSectionSchema).default([]),
	fields: z.array(automationSettingFieldSchema).default([]),
});

export const automationOutputContractSchema = z.object({
	kind: z.enum([
		"session_reply",
		"notification",
		"email_draft",
		"gmail_label",
		"gmail_archive",
		"document",
		"sheet",
		"calendar_event",
		"memory",
		"external_record",
	]),
	label: z.string().min(1),
	required: z.boolean().default(false),
	config: metadataSchema.default({}),
});

export const automationIntegrationRequirementSchema = z.object({
	provider: z.string().min(1),
	label: z.string().min(1),
	scopes: z.array(z.string().min(1)).default([]),
	tools: z.array(z.string().min(1)).default([]),
	required: z.boolean().default(true),
	reason: z.string().optional(),
});

export const automationToolGroupSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	description: z.string().optional(),
	tools: z.array(z.string().min(1)).default([]),
});

export const automationRunSummarySchema = z.object({
	status: automationRunSummaryStatusSchema,
	title: z.string().nullable().default(null),
	preview: z.string().nullable().default(null),
	toolCallCount: z.number().int().min(0).default(0),
	approvalCount: z.number().int().min(0).default(0),
	artifactCount: z.number().int().min(0).default(0),
	notificationCount: z.number().int().min(0).default(0),
	sourceLinks: z.array(metadataSchema).default([]),
	errorSummary: z.string().nullable().default(null),
	lastEventAt: isoDateTimeSchema.nullable().default(null),
	metadata: metadataSchema.default({}),
});

export const automationInvocationEventSeveritySchema = z.enum(["info", "warning", "error"]);

export const automationInvocationEventSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	automationId: uuidSchema,
	invocationId: uuidSchema,
	eventType: z.string().min(1),
	severity: automationInvocationEventSeveritySchema.default("info"),
	title: z.string().min(1),
	message: z.string().nullable().default(null),
	metadata: metadataSchema.default({}),
	createdAt: isoDateTimeSchema,
});

export const automationRunStatsSchema = z.object({
	runCount24h: z.number().int().min(0).default(0),
	runCount7d: z.number().int().min(0).default(0),
	lastStatus: automationInvocationStatusSchema.nullable().default(null),
	lastRunAt: isoDateTimeSchema.nullable().default(null),
});

const defaultAutomationRunStats = {
	runCount24h: 0,
	runCount7d: 0,
	lastStatus: null,
	lastRunAt: null,
} as const;

export const automationMemorySchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	automationId: uuidSchema,
	content: z.string().min(1),
	metadata: metadataSchema.default({}),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const automationVersionSchema = z.object({
	id: uuidSchema,
	automationId: uuidSchema,
	version: z.number().int().positive(),
	changeSummary: z.string().nullable().default(null),
	snapshot: metadataSchema,
	createdAt: isoDateTimeSchema,
});

export type AutomationSettingOption = z.infer<typeof automationSettingOptionSchema>;
export type AutomationSettingFieldType = z.infer<typeof automationSettingFieldTypeSchema>;
export type AutomationSettingField = z.infer<typeof automationSettingFieldSchema>;
export type AutomationSettingsSection = z.infer<typeof automationSettingsSectionSchema>;
export type AutomationSettingsSchema = z.infer<typeof automationSettingsSchemaSchema>;
export type AutomationOutputContract = z.infer<typeof automationOutputContractSchema>;
export type AutomationIntegrationRequirement = z.infer<
	typeof automationIntegrationRequirementSchema
>;
export type AutomationToolGroup = z.infer<typeof automationToolGroupSchema>;
export type AutomationRunSummary = z.infer<typeof automationRunSummarySchema>;
export type AutomationInvocationEvent = z.infer<typeof automationInvocationEventSchema>;
export type AutomationRunStats = z.infer<typeof automationRunStatsSchema>;
export type AutomationMemory = z.infer<typeof automationMemorySchema>;
export type AutomationVersion = z.infer<typeof automationVersionSchema>;

export const automationAccountSelectorSchema = z
	.object({
		provider: connectionProviderSchema,
		accountIds: z.array(uuidSchema).default([]),
	})
	.passthrough();

export const automationTriggerAccountScopeSchema = z.union([
	z.literal("all"),
	automationAccountSelectorSchema,
]);

export const automationToolAccountScopeSchema = z.union([
	z.literal("primary_account"),
	z.literal("trigger_account"),
	automationAccountSelectorSchema,
]);

export const automationAccountScopeSchema = z
	.object({
		allowWebhookAccountOverride: z.boolean().default(false),
		toolAccounts: automationToolAccountScopeSchema.default("primary_account"),
		triggerAccounts: automationTriggerAccountScopeSchema.default("all"),
	})
	.passthrough();

export type AutomationAccountSelector = z.infer<typeof automationAccountSelectorSchema>;
export type AutomationTriggerAccountScope = z.infer<typeof automationTriggerAccountScopeSchema>;
export type AutomationToolAccountScope = z.infer<typeof automationToolAccountScopeSchema>;
export type AutomationAccountScope = z.infer<typeof automationAccountScopeSchema>;

export const automationSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	templateKey: z.string().nullable(),
	templateVersion: z.number().int(),
	version: z.number().int().positive().default(1),
	name: z.string().min(1),
	description: z.string().nullable(),
	status: automationStatusSchema,
	mode: automationModeSchema,
	systemPrompt: z.string().nullable(),
	templateSnapshot: metadataSchema.default({}),
	settingsSchema: automationSettingsSchemaSchema.default({ version: 1, sections: [], fields: [] }),
	settingsValues: metadataSchema.default({}),
	outputContracts: z.array(automationOutputContractSchema).default([]),
	integrationRequirements: z.array(automationIntegrationRequirementSchema).default([]),
	callableAutomationIds: z.array(uuidSchema).default([]),
	accountScope: metadataSchema,
	metadata: metadataSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const automationTriggerSchema = z.object({
	id: uuidSchema,
	automationId: uuidSchema,
	triggerType: automationTriggerTypeSchema,
	displayName: z.string().nullable().default(null),
	config: metadataSchema,
	gateConfig: metadataSchema.default({}),
	sourceAccountScope: metadataSchema.default({}),
	enabled: z.boolean(),
	timezone: z.string().nullable(),
	nextRunAt: isoDateTimeSchema.nullable(),
	lastRunAt: isoDateTimeSchema.nullable(),
	lastMatchAt: isoDateTimeSchema.nullable().default(null),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const automationToolBindingSchema = z.object({
	id: uuidSchema,
	automationId: uuidSchema,
	toolName: z.string().min(1),
	toolsetId: z.string().nullable().default(null),
	displayGroup: z.string().nullable().default(null),
	connectorAccountId: uuidSchema.nullable(),
	permissionOverride: agentToolPermissionDecisionSchema.nullable(),
	requiredScopes: z.array(z.string().min(1)).default([]),
	sideEffectClass: agentToolSideEffectClassSchema.default("read"),
	unavailableReason: z.string().nullable().default(null),
	enabled: z.boolean(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export const automationInvocationSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	automationId: uuidSchema,
	sessionId: uuidSchema.nullable().default(null),
	agentRunId: uuidSchema.nullable().default(null),
	triggerId: uuidSchema.nullable(),
	triggerEventId: uuidSchema.nullable(),
	triggerType: automationTriggerTypeSchema.nullable(),
	logicalTriggerType: z.string().nullable().default(null),
	parentInvocationId: uuidSchema.nullable().default(null),
	callDepth: z.number().int().min(0).default(0),
	callChain: z.array(uuidSchema).default([]),
	automationVersion: z.number().int().positive().default(1),
	status: automationInvocationStatusSchema,
	input: metadataSchema,
	sourceAnchor: metadataSchema.default({}),
	dedupeKey: z.string().nullable(),
	compiledPromptHash: z.string().nullable().default(null),
	runSummary: automationRunSummarySchema.nullable().default(null),
	errorSummary: z.string().nullable(),
	startedAt: isoDateTimeSchema.nullable(),
	finishedAt: isoDateTimeSchema.nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type Automation = z.infer<typeof automationSchema>;
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export type AutomationToolBinding = z.infer<typeof automationToolBindingSchema>;
export type AutomationInvocation = z.infer<typeof automationInvocationSchema>;

export const automationWebhookSchema = z.object({
	id: uuidSchema,
	automationId: uuidSchema,
	enabled: z.boolean(),
	defaultAccountScope: metadataSchema.default({}),
	allowAccountOverride: z.boolean().default(false),
	urlPath: z.string().min(1),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type AutomationWebhook = z.infer<typeof automationWebhookSchema>;

// Template definitions are authored in code (packages/automations) and exposed
// to the product as typed data.

export const automationTemplatePreferenceTypeSchema = z.enum([
	"text",
	"string",
	"textarea",
	"number",
	"boolean",
	"select",
	"multi_select",
	"chip_list",
	"string_list",
	"repeated_object",
	"time",
	"day_of_week",
	"relative_duration",
	"timezone",
	"url",
	"color",
	"account_picker",
	"integration_picker",
	"toolset_picker",
	"output_destination",
	"json",
]);

export const automationTemplatePreferenceFieldSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	type: automationTemplatePreferenceTypeSchema,
	description: z.string().optional(),
	required: z.boolean().default(false),
	default: z.unknown().optional(),
	options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().positive().optional(),
	advanced: z.boolean().default(false),
	sectionKey: z.string().min(1).optional(),
	config: metadataSchema.default({}),
});

export const automationTemplateTriggerSchema = z.object({
	triggerType: automationTriggerTypeSchema,
	displayName: z.string().optional(),
	config: metadataSchema.default({}),
	gateConfig: metadataSchema.default({}),
	sourceAccountScope: metadataSchema.default({}),
	editable: z.boolean().default(true),
});

export const automationTemplateSchema = z.object({
	key: z.string().min(1),
	version: z.number().int(),
	name: z.string().min(1),
	description: z.string(),
	category: z.string().min(1),
	mode: automationModeSchema,
	systemPrompt: z.string(),
	status: z.enum(["available", "beta", "disabled"]),
	tools: z.array(z.string()),
	triggers: z.array(automationTemplateTriggerSchema),
	preferenceFields: z.array(automationTemplatePreferenceFieldSchema),
	defaultPreferences: metadataSchema,
	settingsSchema: automationSettingsSchemaSchema.default({ version: 1, sections: [], fields: [] }),
	defaultSettings: metadataSchema.default({}),
	outputContracts: z.array(automationOutputContractSchema).default([]),
	integrationRequirements: z.array(automationIntegrationRequirementSchema).default([]),
	toolGroups: z.array(automationToolGroupSchema).default([]),
	available: z.boolean(),
	// When true, this template is surfaced in the automations list as a
	// toggleable "default automation" (off until enabled). Defaults to true so
	// every stock template is a default unless explicitly marked agent-only.
	isDefault: z.boolean().default(true),
});

export type AutomationTemplatePreferenceType = z.infer<
	typeof automationTemplatePreferenceTypeSchema
>;
export type AutomationTemplatePreferenceField = z.infer<
	typeof automationTemplatePreferenceFieldSchema
>;
export type AutomationTemplateTrigger = z.infer<typeof automationTemplateTriggerSchema>;
export type AutomationTemplate = z.infer<typeof automationTemplateSchema>;

// Request schemas.

export const automationTriggerCreateRequestSchema = z.object({
	triggerType: automationTriggerTypeSchema,
	displayName: z.string().trim().min(1).max(160).nullable().optional(),
	config: metadataSchema.default({}),
	gateConfig: metadataSchema.default({}),
	sourceAccountScope: metadataSchema.default({}),
	enabled: z.boolean().default(true),
});

export const automationToolBindingCreateInputSchema = z.object({
	toolName: z.string().trim().min(1),
	enabled: z.boolean().default(true),
	connectorAccountId: uuidSchema.nullable().default(null),
	permissionOverride: agentToolPermissionDecisionSchema.nullable().default(null),
	toolsetId: z.string().trim().min(1).nullable().default(null),
	displayGroup: z.string().trim().min(1).nullable().default(null),
	requiredScopes: z.array(z.string().trim().min(1)).default([]),
	sideEffectClass: agentToolSideEffectClassSchema.default("read"),
	unavailableReason: z.string().trim().min(1).nullable().default(null),
});

export const automationTemplateCreateRequestSchema = z.object({
	kind: z.literal("template").default("template"),
	templateKey: z.string().trim().min(1).max(120),
	name: z.string().trim().min(1).max(200).optional(),
	mode: automationModeSchema.optional(),
	settingsValues: metadataSchema.optional(),
	enabled: z.boolean().optional(),
	triggers: z.array(automationTriggerCreateRequestSchema).optional(),
});

export const automationCustomCreateRequestSchema = z
	.object({
		kind: z.literal("custom"),
		name: z.string().trim().min(1).max(200),
		description: z.string().trim().min(1).max(1000).nullable().optional(),
		mode: automationModeSchema.optional(),
		systemPrompt: z.string().trim().max(20000).nullable().optional(),
		status: z.enum(["enabled", "disabled"]).default("enabled"),
		settingsSchema: automationSettingsSchemaSchema.default({
			version: 1,
			sections: [],
			fields: [],
		}),
		settingsValues: metadataSchema.default({}),
		outputContracts: z.array(automationOutputContractSchema).default([]),
		integrationRequirements: z.array(automationIntegrationRequirementSchema).default([]),
		accountScope: metadataSchema.default({}),
		callableAutomationIds: z.array(uuidSchema).default([]),
		triggers: z.array(automationTriggerCreateRequestSchema).min(1),
		toolBindings: z.array(automationToolBindingCreateInputSchema).min(1),
	})
	.refine((value) => Boolean(value.systemPrompt?.trim().length), {
		message: "Custom automations need a system prompt.",
		path: ["systemPrompt"],
	})
	.refine((value) => value.toolBindings.some((binding) => binding.enabled), {
		message: "Custom automations need at least one enabled tool binding.",
		path: ["toolBindings"],
	});

export const automationCreateRequestSchema = z.union([
	automationCustomCreateRequestSchema,
	automationTemplateCreateRequestSchema,
]);

export const automationUpdateRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		status: automationStatusSchema.optional(),
		mode: automationModeSchema.optional(),
		settingsValues: metadataSchema.optional(),
		callableAutomationIds: z.array(uuidSchema).optional(),
		accountScope: metadataSchema.optional(),
		systemPrompt: z.string().trim().max(20000).nullable().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one automation field must be provided.",
	});

export const automationRunNowRequestSchema = z.object({
	input: metadataSchema.optional(),
});

export const automationTestRequestSchema = z
	.object({
		input: metadataSchema.optional(),
		sourceEventId: uuidSchema.optional(),
		idempotencyKey: z.string().trim().min(1).max(200).optional(),
	})
	.refine((value) => value.input !== undefined || value.sourceEventId !== undefined, {
		message: "Test runs require either input or sourceEventId.",
		path: ["input"],
	})
	.refine((value) => !(value.input !== undefined && value.sourceEventId !== undefined), {
		message: "Provide either input or sourceEventId, not both.",
		path: ["sourceEventId"],
	});

export const automationDryRunRequestSchema = z.object({
	input: metadataSchema.optional(),
	sourceAnchor: metadataSchema.optional(),
	sourceEventId: uuidSchema.optional(),
	triggerId: uuidSchema.optional(),
	triggerType: automationTriggerTypeSchema.optional(),
});

export const automationSettingsUpdateRequestSchema = z.object({
	settingsValues: metadataSchema,
});

export const automationMemoryPatchRequestSchema = z.object({
	memories: z.array(
		z.object({
			id: uuidSchema.optional(),
			content: z.string().trim().min(1).max(12000),
			metadata: metadataSchema.default({}),
		}),
	),
});

export const automationAccountScopeUpdateRequestSchema = z.object({
	accountScope: metadataSchema,
});

export const automationTriggerUpdateRequestSchema = z
	.object({
		displayName: z.string().trim().min(1).max(160).nullable().optional(),
		config: metadataSchema.optional(),
		gateConfig: metadataSchema.optional(),
		sourceAccountScope: metadataSchema.optional(),
		enabled: z.boolean().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one trigger field must be provided.",
	});

export const automationToolBindingUpdateSchema = z.object({
	toolName: z.string().trim().min(1),
	enabled: z.boolean().optional(),
	connectorAccountId: uuidSchema.nullable().optional(),
	permissionOverride: agentToolPermissionDecisionSchema.nullable().optional(),
	toolsetId: z.string().trim().min(1).nullable().optional(),
	displayGroup: z.string().trim().min(1).nullable().optional(),
	requiredScopes: z.array(z.string().trim().min(1)).optional(),
	sideEffectClass: agentToolSideEffectClassSchema.optional(),
	unavailableReason: z.string().trim().min(1).nullable().optional(),
});

export const automationToolsUpdateRequestSchema = z.object({
	toolBindings: z.array(automationToolBindingUpdateSchema).min(1),
});

export const automationCompositionSurfaceSchema = z.enum(["chat", "automation", "anchored"]);
export const automationCompositionOperationSchema = z.enum([
	"automation.list",
	"automation.get",
	"automation.create",
	"automation.update",
	"automation.setEnabled",
	"automation.dryRun",
	"automation.test",
]);

const automationCompositionBaseRequestSchema = z.object({
	operation: automationCompositionOperationSchema,
	surface: automationCompositionSurfaceSchema.default("chat"),
	sessionId: uuidSchema.optional(),
	toolCallId: z.string().trim().min(1).max(200).optional(),
});

export const automationCompositionFieldPatchSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		mode: automationModeSchema.optional(),
		settingsValues: metadataSchema.optional(),
		callableAutomationIds: z.array(uuidSchema).optional(),
		accountScope: metadataSchema.optional(),
		systemPrompt: z.string().trim().max(20000).nullable().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one automation field must be provided.",
	});

export const automationCompositionToolOpsSchema = z
	.object({
		add: z.array(automationToolBindingUpdateSchema).default([]),
		update: z.array(automationToolBindingUpdateSchema).default([]),
		remove: z.array(z.string().trim().min(1)).default([]),
	})
	.refine((value) => value.add.length > 0 || value.update.length > 0 || value.remove.length > 0, {
		message: "At least one tool operation must be provided.",
	});

export const automationCompositionTriggerUpdateOpSchema = z.object({
	triggerId: uuidSchema,
	patch: automationTriggerUpdateRequestSchema,
});

export const automationCompositionTriggerOpsSchema = z
	.object({
		add: z.array(automationTriggerCreateRequestSchema).default([]),
		update: z.array(automationCompositionTriggerUpdateOpSchema).default([]),
		disable: z.array(uuidSchema).default([]),
	})
	.refine((value) => value.add.length > 0 || value.update.length > 0 || value.disable.length > 0, {
		message: "At least one trigger operation must be provided.",
	});

export const automationCompositionListRequestSchema = automationCompositionBaseRequestSchema.extend(
	{
		operation: z.literal("automation.list"),
		callableOnly: z.boolean().default(false),
		enabled: z.boolean().optional(),
		query: z.string().trim().min(1).max(200).optional(),
		pagination: paginationRequestSchema.default({ limit: 25 }),
	},
);

export const automationCompositionGetRequestSchema = automationCompositionBaseRequestSchema.extend({
	operation: z.literal("automation.get"),
	automationId: uuidSchema,
});

export const automationCompositionCreateRequestSchema =
	automationCompositionBaseRequestSchema.extend({
		operation: z.literal("automation.create"),
		request: automationCreateRequestSchema,
	});

export const automationCompositionUpdateRequestSchema = automationCompositionBaseRequestSchema
	.extend({
		operation: z.literal("automation.update"),
		automationId: uuidSchema,
		fields: automationCompositionFieldPatchSchema.optional(),
		tools: automationCompositionToolOpsSchema.optional(),
		triggers: automationCompositionTriggerOpsSchema.optional(),
	})
	.refine(
		(value) =>
			value.fields !== undefined || value.tools !== undefined || value.triggers !== undefined,
		{ message: "At least one update operation must be provided." },
	);

export const automationCompositionSetEnabledRequestSchema =
	automationCompositionBaseRequestSchema.extend({
		operation: z.literal("automation.setEnabled"),
		automationId: uuidSchema,
		enabled: z.boolean(),
	});

export const automationCompositionDryRunRequestSchema =
	automationCompositionBaseRequestSchema.extend({
		operation: z.literal("automation.dryRun"),
		automationId: uuidSchema,
		request: automationDryRunRequestSchema.default({}),
	});

export const automationCompositionTestRequestSchema = automationCompositionBaseRequestSchema.extend(
	{
		operation: z.literal("automation.test"),
		automationId: uuidSchema,
		request: automationTestRequestSchema,
	},
);

export const automationCompositionRequestSchema = z.union([
	automationCompositionListRequestSchema,
	automationCompositionGetRequestSchema,
	automationCompositionCreateRequestSchema,
	automationCompositionUpdateRequestSchema,
	automationCompositionSetEnabledRequestSchema,
	automationCompositionDryRunRequestSchema,
	automationCompositionTestRequestSchema,
]);

export const automationWebhookUpdateRequestSchema = z
	.object({
		allowAccountOverride: z.boolean().optional(),
		defaultAccountScope: metadataSchema.optional(),
		enabled: z.boolean().optional(),
		rotateSecret: z.boolean().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one webhook field must be provided.",
	});

/** Export envelopes minted before the systemPrompt unification carry
 * `instructions` + `promptTemplate`; fold them (template-wins, matching the
 * old compiler priority) so old exports stay importable. */
function foldLegacyPromptKeys(value: unknown): unknown {
	if (!value || typeof value !== "object" || Object.hasOwn(value, "systemPrompt")) {
		return value;
	}
	const { instructions, promptTemplate, ...rest } = value as Record<string, unknown>;
	const template =
		typeof promptTemplate === "string" && promptTemplate.trim() ? promptTemplate : null;
	return {
		...rest,
		systemPrompt: template ?? (typeof instructions === "string" ? instructions : null),
	};
}

export const automationExportSchema = z.object({
	version: z.literal(1),
	exportedAt: isoDateTimeSchema,
	source: z
		.object({
			app: z.literal("unison").default("unison"),
			automationId: uuidSchema.optional(),
			automationVersion: z.number().int().positive().optional(),
			templateKey: z.string().nullable().optional(),
		})
		.default({ app: "unison" }),
	automation: z.preprocess(
		foldLegacyPromptKeys,
		z.object({
			accountScope: metadataSchema,
			description: z.string().nullable(),
			systemPrompt: z.string().nullable(),
			integrationRequirements: z.array(automationIntegrationRequirementSchema),
			callableAutomationIds: z.array(uuidSchema).default([]),
			mode: automationModeSchema,
			name: z.string().min(1),
			outputContracts: z.array(automationOutputContractSchema),
			settingsSchema: automationSettingsSchemaSchema,
			settingsValues: metadataSchema,
			status: automationStatusSchema,
			templateKey: z.string().nullable(),
			templateSnapshot: metadataSchema,
			templateVersion: z.number().int(),
			version: z.number().int().positive().default(1),
		}),
	),
	toolBindings: z.array(
		z.object({
			displayGroup: z.string().nullable(),
			enabled: z.boolean(),
			permissionOverride: agentToolPermissionDecisionSchema.nullable(),
			requiredScopes: z.array(z.string().min(1)),
			sideEffectClass: agentToolSideEffectClassSchema,
			toolName: z.string().min(1),
			toolsetId: z.string().nullable(),
		}),
	),
	triggers: z.array(
		z.object({
			config: metadataSchema,
			displayName: z.string().nullable(),
			enabled: z.boolean(),
			gateConfig: metadataSchema,
			sourceAccountScope: metadataSchema,
			triggerType: automationTriggerTypeSchema,
		}),
	),
});

export const automationImportRequestSchema = z.object({
	automation: automationExportSchema,
	enabled: z.boolean().optional(),
	name: z.string().trim().min(1).max(200).optional(),
});

export type AutomationCreateRequest = z.input<typeof automationCreateRequestSchema>;
export type AutomationCustomCreateRequest = z.input<typeof automationCustomCreateRequestSchema>;
export type AutomationTemplateCreateRequest = z.input<typeof automationTemplateCreateRequestSchema>;
export type AutomationUpdateRequest = z.infer<typeof automationUpdateRequestSchema>;
export type AutomationRunNowRequest = z.infer<typeof automationRunNowRequestSchema>;
export type AutomationTestRequest = z.infer<typeof automationTestRequestSchema>;
export type AutomationDryRunRequest = z.infer<typeof automationDryRunRequestSchema>;
export type AutomationSettingsUpdateRequest = z.infer<typeof automationSettingsUpdateRequestSchema>;
export type AutomationAccountScopeUpdateRequest = z.infer<
	typeof automationAccountScopeUpdateRequestSchema
>;
export type AutomationMemoryPatchRequest = z.infer<typeof automationMemoryPatchRequestSchema>;
export type AutomationTriggerCreateRequest = z.infer<typeof automationTriggerCreateRequestSchema>;
export type AutomationTriggerUpdateRequest = z.infer<typeof automationTriggerUpdateRequestSchema>;
export type AutomationToolBindingCreateInput = z.input<
	typeof automationToolBindingCreateInputSchema
>;
export type AutomationToolBindingUpdate = z.infer<typeof automationToolBindingUpdateSchema>;
export type AutomationToolsUpdateRequest = z.infer<typeof automationToolsUpdateRequestSchema>;
export type AutomationCompositionSurface = z.infer<typeof automationCompositionSurfaceSchema>;
export type AutomationCompositionOperation = z.infer<typeof automationCompositionOperationSchema>;
export type AutomationCompositionFieldPatch = z.infer<typeof automationCompositionFieldPatchSchema>;
export type AutomationCompositionToolOps = z.infer<typeof automationCompositionToolOpsSchema>;
export type AutomationCompositionTriggerOps = z.infer<typeof automationCompositionTriggerOpsSchema>;
export type AutomationCompositionRequest = z.infer<typeof automationCompositionRequestSchema>;
export type AutomationWebhookUpdateRequest = z.infer<typeof automationWebhookUpdateRequestSchema>;
export type AutomationExport = z.infer<typeof automationExportSchema>;
export type AutomationImportRequest = z.infer<typeof automationImportRequestSchema>;

// Response schemas.

export const automationWithRelationsSchema = z.object({
	automation: automationSchema,
	runStats: automationRunStatsSchema.default(defaultAutomationRunStats),
	triggers: z.array(automationTriggerSchema),
	toolBindings: z.array(automationToolBindingSchema),
});

export const automationTemplateListResponseSchema = z.object({
	templates: z.array(automationTemplateSchema),
});

export const automationListResponseSchema = z.object({
	pagination: paginationResponseSchema,
	automations: z.array(automationWithRelationsSchema),
});

export const automationDetailResponseSchema = z.object({
	automation: automationSchema,
	integrationHealth: z
		.array(
			z.object({
				healthy: z.boolean(),
				label: z.string().min(1),
				missingScopes: z.array(z.string().min(1)).default([]),
				provider: z.string().min(1),
				reason: z.string().nullable().default(null),
				required: z.boolean().default(true),
				status: z.enum(["healthy", "missing", "partial", "unavailable"]),
			}),
		)
		.default([]),
	triggers: z.array(automationTriggerSchema),
	toolBindings: z.array(automationToolBindingSchema),
	recentInvocations: z.array(automationInvocationSchema),
	runStats: automationRunStatsSchema.default(defaultAutomationRunStats),
	memories: z.array(automationMemorySchema).default([]),
	versions: z.array(automationVersionSchema).default([]),
});

export const automationActionResponseSchema = z.object({
	automation: automationSchema,
	runStats: automationRunStatsSchema.default(defaultAutomationRunStats),
	triggers: z.array(automationTriggerSchema),
	toolBindings: z.array(automationToolBindingSchema),
	integrationHealth: automationDetailResponseSchema.shape.integrationHealth.optional(),
});

export const automationInvocationListResponseSchema = z.object({
	pagination: paginationResponseSchema,
	invocations: z.array(automationInvocationSchema),
});

export const automationRunNowResponseSchema = z.object({
	invocation: automationInvocationSchema,
});

export const automationTestResponseSchema = z.object({
	invocation: automationInvocationSchema,
});

export const automationPromptPreviewResponseSchema = z.object({
	hash: z.string().min(1),
	/** assignment + referenceMessage joined, for one-box preview surfaces. */
	prompt: z.string().min(1),
	/** System-prompt assignment block compiled for this automation. */
	assignment: z.string().min(1),
	/** Example trigger reference message (the session's first message). */
	referenceMessage: z.string().min(1),
	settingsValues: metadataSchema,
	sourceAnchor: metadataSchema,
	outputContracts: z.array(automationOutputContractSchema),
	integrationRequirements: z.array(automationIntegrationRequirementSchema),
});

export const automationDryRunResponseSchema = z.object({
	status: z.enum(["would_run", "would_skip", "blocked"]),
	reason: z.string().min(1),
	promptHash: z.string().min(1),
	promptPreview: z.string().min(1),
	missingRequirements: z.array(automationIntegrationRequirementSchema).default([]),
	outputContracts: z.array(automationOutputContractSchema),
	preflightChecks: z
		.array(
			z.object({
				key: z.string().min(1),
				label: z.string().min(1),
				status: z.enum(["pass", "warning", "fail", "skipped"]),
				detail: z.string().nullable().default(null),
				metadata: metadataSchema.default({}),
			}),
		)
		.default([]),
	triggerMatch: z
		.object({
			eventType: z.string().nullable().default(null),
			matched: z.boolean(),
			provider: z.string().nullable().default(null),
			reason: z.string().min(1),
			triggerId: uuidSchema.nullable().default(null),
			triggerType: automationTriggerTypeSchema.nullable().default(null),
		})
		.nullable()
		.default(null),
});

export const automationExportResponseSchema = z.object({
	automation: automationExportSchema,
});

export const automationRunDetailResponseSchema = z.object({
	automation: automationSchema,
	events: z.array(automationInvocationEventSchema).default([]),
	invocation: automationInvocationSchema,
	runSummary: automationRunSummarySchema,
});

export const automationMemoryResponseSchema = z.object({
	memories: z.array(automationMemorySchema),
});

export const automationWebhookActionResponseSchema = z.object({
	secret: z.string().nullable().default(null),
	webhook: automationWebhookSchema,
});

export const automationWebhookReceiveResponseSchema = z.object({
	accepted: z.boolean(),
	processed: z.boolean(),
	sourceEventId: uuidSchema.nullable().default(null),
});

export const automationCompositionListResponseSchema = automationListResponseSchema.extend({
	operation: z.literal("automation.list"),
});

export const automationCompositionGetResponseSchema = automationDetailResponseSchema.extend({
	operation: z.literal("automation.get"),
});

export const automationCompositionCreateResponseSchema = automationActionResponseSchema.extend({
	operation: z.literal("automation.create"),
});

export const automationCompositionUpdateResponseSchema = automationActionResponseSchema.extend({
	operation: z.literal("automation.update"),
});

export const automationCompositionSetEnabledResponseSchema = automationActionResponseSchema.extend({
	operation: z.literal("automation.setEnabled"),
});

export const automationCompositionDryRunResponseSchema = automationDryRunResponseSchema.extend({
	operation: z.literal("automation.dryRun"),
});

export const automationCompositionTestResponseSchema = automationTestResponseSchema.extend({
	operation: z.literal("automation.test"),
});

export const automationCompositionResponseSchema = z.discriminatedUnion("operation", [
	automationCompositionListResponseSchema,
	automationCompositionGetResponseSchema,
	automationCompositionCreateResponseSchema,
	automationCompositionUpdateResponseSchema,
	automationCompositionSetEnabledResponseSchema,
	automationCompositionDryRunResponseSchema,
	automationCompositionTestResponseSchema,
]);

export type AutomationWithRelations = z.infer<typeof automationWithRelationsSchema>;
export type AutomationTemplateListResponse = z.infer<typeof automationTemplateListResponseSchema>;
export type AutomationListResponse = z.infer<typeof automationListResponseSchema>;
export type AutomationDetailResponse = z.infer<typeof automationDetailResponseSchema>;
export type AutomationActionResponse = z.infer<typeof automationActionResponseSchema>;
export type AutomationInvocationListResponse = z.infer<
	typeof automationInvocationListResponseSchema
>;
export type AutomationRunNowResponse = z.infer<typeof automationRunNowResponseSchema>;
export type AutomationTestResponse = z.infer<typeof automationTestResponseSchema>;
export type AutomationPromptPreviewResponse = z.infer<typeof automationPromptPreviewResponseSchema>;
export type AutomationDryRunResponse = z.infer<typeof automationDryRunResponseSchema>;
export type AutomationExportResponse = z.infer<typeof automationExportResponseSchema>;
export type AutomationRunDetailResponse = z.infer<typeof automationRunDetailResponseSchema>;
export type AutomationMemoryResponse = z.infer<typeof automationMemoryResponseSchema>;
export type AutomationWebhookActionResponse = z.infer<typeof automationWebhookActionResponseSchema>;
export type AutomationWebhookReceiveResponse = z.infer<
	typeof automationWebhookReceiveResponseSchema
>;
export type AutomationCompositionResponse = z.infer<typeof automationCompositionResponseSchema>;
