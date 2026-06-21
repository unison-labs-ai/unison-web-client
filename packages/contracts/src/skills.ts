import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./shared";

// ===========================================================================
// Skills
//
// User-authored markdown "skills" — reusable playbooks, house styles, and
// domain SOPs the user uploads and the agent can load on demand. Skills are
// app-owned rows (like documents), never written to the brain. The agent sees
// a small always-on catalog of `name + description` in its system prompt and
// pulls a skill's full body via the skill.load tool when a task matches, or
// when the user forces it with `/skill <name>` (progressive disclosure).
//
// `name` is the stable lowercase handle used by `/skill <name>` and the
// catalog; `title` is the human label. `description` is the trigger surface —
// it tells the agent what the skill does and when to use it. `enabled` lets a
// user keep a skill but exclude it from the catalog. `version` is the
// optimistic-concurrency token. Deleted skills are soft-deleted and never
// appear on the wire. See docs/plans/skills/skillplan.md.
// ===========================================================================

/** Hard caps, enforced in contracts + store. */
export const SKILL_BODY_MAX_CHARS = 100_000;
export const SKILL_TITLE_MAX_CHARS = 200;
export const SKILL_NAME_MAX_CHARS = 64;
export const SKILL_DESCRIPTION_MAX_CHARS = 1_024;
export const SKILL_DEFAULT_TITLE = "Untitled skill";

/** Lowercase kebab handle: letters/numbers segments joined by single hyphens. */
export const skillNameSchema = z
	.string()
	.min(1)
	.max(SKILL_NAME_MAX_CHARS)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const skillRecordSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	name: skillNameSchema,
	title: z.string().min(1),
	description: z.string(),
	bodyMd: z.string(),
	enabled: z.boolean(),
	version: z.number().int().min(1),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

/** List rows omit the body; bodyLength lets clients show size without it. */
export const skillListItemSchema = skillRecordSchema.omit({ bodyMd: true }).extend({
	bodyLength: z.number().int().min(0),
});

/** One catalog entry surfaced to the agent — never carries the body. */
export const skillCatalogEntrySchema = z.object({
	id: uuidSchema,
	name: skillNameSchema,
	title: z.string().min(1),
	description: z.string(),
});

export const skillCreateRequestSchema = z.object({
	title: z.string().trim().min(1).max(SKILL_TITLE_MAX_CHARS).default(SKILL_DEFAULT_TITLE),
	/** Optional explicit handle; derived from the title when omitted. */
	name: skillNameSchema.optional(),
	description: z.string().trim().max(SKILL_DESCRIPTION_MAX_CHARS).default(""),
	bodyMd: z.string().max(SKILL_BODY_MAX_CHARS).default(""),
});

export const skillUpdateRequestSchema = z
	.object({
		title: z.string().trim().min(1).max(SKILL_TITLE_MAX_CHARS).optional(),
		name: skillNameSchema.optional(),
		description: z.string().trim().max(SKILL_DESCRIPTION_MAX_CHARS).optional(),
		bodyMd: z.string().max(SKILL_BODY_MAX_CHARS).optional(),
		enabled: z.boolean().optional(),
		/**
		 * Optimistic-concurrency token; when present and stale the API answers
		 * 409 version_conflict instead of clobbering.
		 */
		baseVersion: z.number().int().min(1).optional(),
	})
	.refine(
		(value) =>
			value.title !== undefined ||
			value.name !== undefined ||
			value.description !== undefined ||
			value.bodyMd !== undefined ||
			value.enabled !== undefined,
		{ message: "At least one field besides baseVersion must be provided." },
	);

export const skillListRequestSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	query: z.string().trim().min(1).max(200).optional(),
});

export const skillListResponseSchema = z.object({
	skills: z.array(skillListItemSchema),
});

export const skillDetailResponseSchema = z.object({
	skill: skillRecordSchema,
});

export const skillDeleteResponseSchema = z.object({
	deleted: z.literal(true),
	skillId: uuidSchema,
});

export type SkillRecord = z.infer<typeof skillRecordSchema>;
export type SkillListItem = z.infer<typeof skillListItemSchema>;
export type SkillCatalogEntry = z.infer<typeof skillCatalogEntrySchema>;
/** What callers send — title/description/body are optional on the wire (schema defaults apply server-side). */
export type SkillCreateRequest = z.input<typeof skillCreateRequestSchema>;
export type SkillUpdateRequest = z.infer<typeof skillUpdateRequestSchema>;
export type SkillListRequest = z.infer<typeof skillListRequestSchema>;
export type SkillListResponse = z.infer<typeof skillListResponseSchema>;
export type SkillDetailResponse = z.infer<typeof skillDetailResponseSchema>;
export type SkillDeleteResponse = z.infer<typeof skillDeleteResponseSchema>;
