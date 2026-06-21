import { z } from "zod";

import { isoDateTimeSchema, metadataSchema, paginationResponseSchema, uuidSchema } from "./shared";

// Wire contracts for the internal eval API (/v1/internal/evals/*) and the
// /observability dashboard. Domain logic lives in @unison/evals; these schemas
// are the redacted, client-safe projection of it
// (docs/evals/architecture/runtime-and-dashboard.md §5-6, §11).

export const evalCategoryWireSchema = z.enum([
	"automation",
	"memory",
	"web",
	"connector",
	"code",
	"context",
	"failure",
]);
export type EvalCategoryWire = z.infer<typeof evalCategoryWireSchema>;

export const evalDimensionWireSchema = z.enum([
	"outcome",
	"trajectory",
	"efficiency",
	"safety",
	"ux",
]);
export type EvalDimensionWire = z.infer<typeof evalDimensionWireSchema>;

export const evalSuiteIdWireSchema = z.enum(["smoke", "nightly", "release-candidate", "targeted"]);
export type EvalSuiteIdWire = z.infer<typeof evalSuiteIdWireSchema>;

export const evalRunStatusWireSchema = z.enum([
	"queued",
	"running",
	"grading",
	"completed",
	"failed",
	"cancelled",
]);
export type EvalRunStatusWire = z.infer<typeof evalRunStatusWireSchema>;

export const evalRunItemStatusWireSchema = z.enum([
	"queued",
	"seeding",
	"running",
	"grading",
	"completed",
	"failed",
	"cancelled",
	"budget_exhausted",
	"timed_out",
	"skipped",
]);
export type EvalRunItemStatusWire = z.infer<typeof evalRunItemStatusWireSchema>;

export const evalVerdictWireSchema = z.enum(["pass", "warn", "fail"]);
export type EvalVerdictWire = z.infer<typeof evalVerdictWireSchema>;

export const evalRetentionPolicyWireSchema = z.enum([
	"delete_after_window",
	"archive_after_window",
	"keep_until_resolved",
	"keep_for_debugging",
]);
export type EvalRetentionPolicyWire = z.infer<typeof evalRetentionPolicyWireSchema>;

export const evalCandidateWireSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1),
	modelSelectorVersion: z.string().nullish(),
	systemPromptHash: z.string().nullish(),
	toolCatalogHash: z.string().nullish(),
	runbookCompilerHash: z.string().nullish(),
	memoryPolicyVersion: z.string().nullish(),
	compactionPolicyVersion: z.string().nullish(),
	connectorFixtureVersion: z.string().nullish(),
	budgetProfile: z.string().min(1),
	codeRevision: z.string().nullish(),
	judgeModel: z.string().nullish(),
	priceTableVersion: z.string().nullish(),
});
export type EvalCandidateWire = z.infer<typeof evalCandidateWireSchema>;

export const evalUsageTotalsWireSchema = z.object({
	inputTokens: z.number().int().nonnegative(),
	outputTokens: z.number().int().nonnegative(),
	cachedTokens: z.number().int().nonnegative(),
	reasoningTokens: z.number().int().nonnegative(),
	estimatedInputTokens: z.number().int().nonnegative(),
	totalTokens: z.number().int().nonnegative(),
	costMicros: z.number().int().nonnegative(),
	modelCalls: z.number().int().nonnegative(),
	toolCalls: z.number().int().nonnegative(),
	failedToolCalls: z.number().int().nonnegative(),
	duplicateToolCalls: z.number().int().nonnegative(),
});
export type EvalUsageTotalsWire = z.infer<typeof evalUsageTotalsWireSchema>;

export const evalRunSummaryWireSchema = z.object({
	aggregateScore: z.number().nullable(),
	passRate: z.number().nullable(),
	criticalFailureCount: z.number().int().nonnegative(),
	categoryScores: z.record(z.string(), z.number()),
	dimensionScores: z.record(z.string(), z.number()),
	usage: evalUsageTotalsWireSchema,
	runtime: z.object({
		p50Ms: z.number().nullable(),
		p95Ms: z.number().nullable(),
		longestMs: z.number().nullable(),
	}),
	baseline: z
		.object({
			runId: uuidSchema,
			aggregateDelta: z.number().nullable(),
			costDeltaMicros: z.number().nullable(),
			categoryDeltas: z.record(z.string(), z.number()),
			dimensionDeltas: z.record(z.string(), z.number()),
		})
		.nullish(),
});
export type EvalRunSummaryWire = z.infer<typeof evalRunSummaryWireSchema>;

export const evalRunWireSchema = z.object({
	id: uuidSchema,
	title: z.string(),
	status: evalRunStatusWireSchema,
	suiteId: evalSuiteIdWireSchema,
	environment: z.string(),
	candidate: evalCandidateWireSchema,
	candidateConfigHash: z.string(),
	baselineRunId: uuidSchema.nullable(),
	startedByEmail: z.string().nullable(),
	startedByScheduler: z.boolean(),
	summary: evalRunSummaryWireSchema.nullable(),
	latestSummary: z.string().nullable(),
	retentionPolicy: evalRetentionPolicyWireSchema,
	retainUntil: isoDateTimeSchema.nullable(),
	cleanupState: z.enum(["pending", "completed", "skipped"]),
	/** Set while a cancel is requested but the runner has not yet stopped. */
	cancelRequestedAt: isoDateTimeSchema.nullish(),
	error: z.string().nullable(),
	itemCounts: z.object({
		total: z.number().int().nonnegative(),
		completed: z.number().int().nonnegative(),
		active: z.number().int().nonnegative(),
		failed: z.number().int().nonnegative(),
	}),
	createdAt: isoDateTimeSchema,
	startedAt: isoDateTimeSchema.nullable(),
	completedAt: isoDateTimeSchema.nullable(),
});
export type EvalRunWire = z.infer<typeof evalRunWireSchema>;

export const evalRunItemWireSchema = z.object({
	id: uuidSchema,
	runId: uuidSchema,
	caseId: z.string(),
	caseVersion: z.number().int().positive(),
	caseTitle: z.string(),
	category: evalCategoryWireSchema,
	trial: z.number().int().positive(),
	status: evalRunItemStatusWireSchema,
	sessionId: uuidSchema.nullable(),
	threadId: uuidSchema.nullable(),
	score: z.number().nullable(),
	verdict: evalVerdictWireSchema.nullable(),
	dimensionScores: z.record(z.string(), z.number()).nullable(),
	criticalFailures: z.array(z.string()),
	latestSummary: z.string().nullable(),
	usage: z
		.object({
			inputTokens: z.number().int().nonnegative(),
			outputTokens: z.number().int().nonnegative(),
			cachedTokens: z.number().int().nonnegative(),
			reasoningTokens: z.number().int().nonnegative(),
			totalTokens: z.number().int().nonnegative(),
			costMicros: z.number().int().nonnegative(),
			modelCalls: z.number().int().nonnegative(),
			toolCalls: z.number().int().nonnegative(),
			failedToolCalls: z.number().int().nonnegative(),
			duplicateToolCalls: z.number().int().nonnegative(),
		})
		.nullable(),
	runtimeMs: z.number().int().nonnegative().nullable(),
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	startedAt: isoDateTimeSchema.nullable(),
	completedAt: isoDateTimeSchema.nullable(),
});
export type EvalRunItemWire = z.infer<typeof evalRunItemWireSchema>;

export const evalScoreWireSchema = z.object({
	id: uuidSchema,
	runItemId: uuidSchema,
	grader: z.enum(["deterministic", "event_log", "schema", "efficiency", "judge", "human"]),
	component: z.string(),
	score: z.number(),
	passed: z.boolean().nullable(),
	detail: metadataSchema,
	judgeModel: z.string().nullable(),
	judgePromptVersion: z.string().nullable(),
	createdAt: isoDateTimeSchema,
});
export type EvalScoreWire = z.infer<typeof evalScoreWireSchema>;

export const evalCaseSummaryWireSchema = z.object({
	id: z.string(),
	category: evalCategoryWireSchema,
	version: z.number().int().positive(),
	title: z.string(),
	intent: z.string(),
	worldMode: z.enum(["synthetic", "recorded", "live", "production_derived"]),
	suiteIds: z.array(evalSuiteIdWireSchema),
});
export type EvalCaseSummaryWire = z.infer<typeof evalCaseSummaryWireSchema>;

export const evalSuiteSummaryWireSchema = z.object({
	id: evalSuiteIdWireSchema,
	name: z.string(),
	description: z.string(),
	caseCount: z.number().int().nonnegative(),
	trialsPerCase: z.number().int().positive(),
	retentionPolicy: evalRetentionPolicyWireSchema,
});
export type EvalSuiteSummaryWire = z.infer<typeof evalSuiteSummaryWireSchema>;

export const evalStartRunRequestSchema = z.object({
	suiteId: evalSuiteIdWireSchema,
	/** Required for targeted suites; optional subset filter otherwise. */
	caseIds: z.array(z.string().min(1)).optional(),
	candidate: z
		.object({
			provider: z.string().min(1).optional(),
			model: z.string().min(1).optional(),
			budgetProfile: z.string().min(1).optional(),
			judgeModel: z.string().min(1).optional(),
		})
		.optional(),
	title: z.string().min(1).max(200).optional(),
});
export type EvalStartRunRequest = z.infer<typeof evalStartRunRequestSchema>;

/** Response for run-producing actions: POST /runs (201) and POST /runs/:id/cancel. */
export const evalRunActionResponseSchema = z.object({
	run: evalRunWireSchema,
});
export type EvalRunActionResponse = z.infer<typeof evalRunActionResponseSchema>;

export const evalRunListResponseSchema = z.object({
	runs: z.array(evalRunWireSchema),
	pagination: paginationResponseSchema,
});
export type EvalRunListResponse = z.infer<typeof evalRunListResponseSchema>;

export const evalRunDetailResponseSchema = z.object({
	run: evalRunWireSchema,
	items: z.array(evalRunItemWireSchema),
	scores: z.array(evalScoreWireSchema),
	baseline: evalRunWireSchema.nullable(),
});
export type EvalRunDetailResponse = z.infer<typeof evalRunDetailResponseSchema>;

export const evalSuitesResponseSchema = z.object({
	suites: z.array(evalSuiteSummaryWireSchema),
});
export type EvalSuitesResponse = z.infer<typeof evalSuitesResponseSchema>;

export const evalCasesResponseSchema = z.object({
	cases: z.array(evalCaseSummaryWireSchema),
});
export type EvalCasesResponse = z.infer<typeof evalCasesResponseSchema>;

export const evalRunEventWireSchema = z.object({
	runId: uuidSchema,
	eventIndex: z.number().int().nonnegative(),
	eventType: z.enum([
		"run.status",
		"run.summary",
		"item.status",
		"item.metrics",
		"item.score",
		"log",
	]),
	payload: metadataSchema,
	createdAt: isoDateTimeSchema,
});
export type EvalRunEventWire = z.infer<typeof evalRunEventWireSchema>;

export const evalSessionOverlayResponseSchema = z.object({
	runId: uuidSchema,
	runItemId: uuidSchema,
	runStatus: evalRunStatusWireSchema,
	itemStatus: evalRunItemStatusWireSchema,
	suiteId: evalSuiteIdWireSchema,
	caseId: z.string(),
	caseTitle: z.string(),
	category: evalCategoryWireSchema,
	candidate: evalCandidateWireSchema,
	candidateConfigHash: z.string(),
	score: z.number().nullable(),
	verdict: evalVerdictWireSchema.nullable(),
	dimensionScores: z.record(z.string(), z.number()).nullable(),
	criticalFailures: z.array(z.string()),
	usage: evalRunItemWireSchema.shape.usage,
	runtimeMs: z.number().int().nonnegative().nullable(),
	timeToFirstTokenMs: z.number().int().nonnegative().nullable(),
	reasoningDurationMs: z.number().int().nonnegative().nullable(),
	budgets: z.object({
		limits: metadataSchema,
		used: metadataSchema,
		status: z.enum(["within_budget", "exhausted_graceful", "exhausted_silent"]).nullable(),
	}),
	perMessageTokenEstimates: z.array(
		z.object({
			messageId: uuidSchema,
			role: z.string(),
			estimatedTokens: z.number().int().nonnegative(),
		}),
	),
	modelCalls: z.array(
		z.object({
			index: z.number().int().nonnegative(),
			provider: z.string(),
			model: z.string(),
			inputTokens: z.number().int().nonnegative(),
			outputTokens: z.number().int().nonnegative(),
			cachedTokens: z.number().int().nonnegative().nullable(),
			reasoningTokens: z.number().int().nonnegative().nullable(),
			costMicros: z.number().int().nonnegative().nullable(),
		}),
	),
	toolCalls: z.array(
		z.object({
			toolName: z.string(),
			calls: z.number().int().nonnegative(),
			failures: z.number().int().nonnegative(),
			duplicates: z.number().int().nonnegative(),
			p50LatencyMs: z.number().nullable(),
		}),
	),
	checks: z.array(
		z.object({
			id: z.string(),
			description: z.string(),
			dimension: evalDimensionWireSchema,
			passed: z.boolean().nullable(),
			severity: z.enum(["normal", "critical"]),
		}),
	),
	judge: z
		.object({
			model: z.string(),
			promptVersion: z.string(),
			rationale: z.string(),
			confidence: z.number(),
			scores: z.record(z.string(), z.number()),
		})
		.nullable(),
});
export type EvalSessionOverlayResponse = z.infer<typeof evalSessionOverlayResponseSchema>;

/** Optional body for POST /runs/:id/bless. */
export const evalBlessRunRequestSchema = z.object({
	note: z.string().min(1).max(2000).optional(),
});
export type EvalBlessRunRequest = z.infer<typeof evalBlessRunRequestSchema>;

export const evalBlessRunResponseSchema = z.object({
	suiteId: evalSuiteIdWireSchema,
	environment: z.string(),
	runId: uuidSchema,
	blessedByEmail: z.string().nullable(),
	createdAt: isoDateTimeSchema,
});
export type EvalBlessRunResponse = z.infer<typeof evalBlessRunResponseSchema>;
