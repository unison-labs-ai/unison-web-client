import { z } from "zod";

// Shared primitives used by both the main contract barrel and the automation
// contracts module. Kept in their own module so `automations.ts` can import
// them without creating an import cycle through `index.ts`.

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime();
export const metadataSchema = z.record(z.string(), z.unknown());

export const paginationRequestSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	cursor: z.string().min(1).optional(),
});

export const paginationResponseSchema = z.object({
	nextCursor: z.string().min(1).nullable(),
	hasMore: z.boolean(),
	limit: z.number().int().min(1).max(100),
});

export type PaginationRequest = z.infer<typeof paginationRequestSchema>;
export type PaginationResponse = z.infer<typeof paginationResponseSchema>;

export const agentToolSideEffectClassSchema = z.enum([
	"read",
	"internal_write",
	"external_draft",
	"external_send",
	"external_write",
	"destructive",
]);
export const agentToolPermissionDecisionSchema = z.enum([
	"always_allow",
	"ask_for_approval",
	"always_reject",
]);

export type AgentToolSideEffectClass = z.infer<typeof agentToolSideEffectClassSchema>;
export type AgentToolPermissionDecision = z.infer<typeof agentToolPermissionDecisionSchema>;

export const executionModeSchema = z.enum(["read_only", "human_in_the_loop", "autonomous"]);

export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const DEFAULT_CHAT_COMPOSER_MODE: ExecutionMode = "human_in_the_loop";

export const connectionProviderSchema = z.enum([
	"google",
	"slack",
	"linear",
	"github",
	"granola",
	"clickup",
	"telegram",
]);

export type ConnectionProvider = z.infer<typeof connectionProviderSchema>;
