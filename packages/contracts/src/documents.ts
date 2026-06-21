import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./shared";

// ===========================================================================
// Documents
//
// Standalone tenant-scoped markdown documents — the durable library the agent
// writes into (document.* tools) and the user edits in the web client.
// Markdown text is the canonical format; the editor is a view over it.
// `version` is the optimistic-concurrency token: every content write carries
// the version it was based on (baseVersion) and bumps it by one. Deleted
// documents are soft-deleted (status='deleted' in the table) and never appear
// on the wire, so the wire model carries no status field.
// See docs/plans/documents/2026-06-12-documents-plan.md.
// ===========================================================================

/** Hard cap on canonical markdown content, enforced in contracts + store. */
export const DOCUMENT_CONTENT_MAX_CHARS = 524_288;
export const DOCUMENT_TITLE_MAX_CHARS = 300;
export const DOCUMENT_DEFAULT_TITLE = "Untitled";

/**
 * Per-row hard budgets for the special always-in-context memory documents
 * (docs/plans/user-profile-document.md). These are the much-smaller caps stored
 * in documents.content_max_chars and enforced in the store; the global ceiling
 * above remains the universal max. The budget is the forcing function that keeps
 * memory selective.
 */
export const PROFILE_CONTENT_MAX_CHARS = 6_000;
export const WORKING_MEMORY_CONTENT_MAX_CHARS = 3_000;
export const AUTOMATION_MEMORY_CONTENT_MAX_CHARS = 2_000;

/**
 * Document kind discriminator. `standard` is an ordinary user/agent document;
 * `profile` and `working_memory` are the two singleton memory docs (one each per
 * user), matched by this column — never by title. `working_memory` is hidden
 * from the documents list.
 */
export const documentKindSchema = z.enum(["standard", "profile", "working_memory"]);

export const documentActorKindSchema = z.enum(["user", "agent", "system"]);

export const documentRecordSchema = z.object({
	id: uuidSchema,
	tenantId: uuidSchema,
	userId: uuidSchema,
	title: z.string().min(1),
	content: z.string(),
	version: z.number().int().min(1),
	kind: documentKindSchema,
	/** Per-row content budget (profile/working_memory); null on standard docs. */
	contentMaxChars: z.number().int().positive().nullable(),
	createdByKind: documentActorKindSchema,
	lastEditedByKind: documentActorKindSchema,
	sourceSessionId: uuidSchema.nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

/** List rows omit content; contentLength lets clients show size without it. */
export const documentListItemSchema = documentRecordSchema.omit({ content: true }).extend({
	contentLength: z.number().int().min(0),
});

export const documentCreateRequestSchema = z.object({
	title: z.string().trim().min(1).max(DOCUMENT_TITLE_MAX_CHARS).default(DOCUMENT_DEFAULT_TITLE),
	content: z.string().max(DOCUMENT_CONTENT_MAX_CHARS).default(""),
});

export const documentUpdateRequestSchema = z
	.object({
		title: z.string().trim().min(1).max(DOCUMENT_TITLE_MAX_CHARS).optional(),
		content: z.string().max(DOCUMENT_CONTENT_MAX_CHARS).optional(),
		/**
		 * Required by convention for content writes (the editor and the agent
		 * always read before writing); when present and stale the API answers
		 * 409 version_conflict instead of clobbering.
		 */
		baseVersion: z.number().int().min(1).optional(),
	})
	.refine((value) => value.title !== undefined || value.content !== undefined, {
		message: "At least one of title or content must be provided.",
	});

export const documentListRequestSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	query: z.string().trim().min(1).max(200).optional(),
});

export const documentListResponseSchema = z.object({
	documents: z.array(documentListItemSchema),
});

export const documentDetailResponseSchema = z.object({
	document: documentRecordSchema,
});

export const documentDeleteResponseSchema = z.object({
	deleted: z.literal(true),
	documentId: uuidSchema,
});

/** File export formats served by GET /v1/documents/:id/export. */
export const documentExportFormatSchema = z.enum(["md", "docx", "pdf"]);

export const documentGoogleDriveExportResponseSchema = z.object({
	fileId: z.string().min(1),
	webViewLink: z.string().url().nullable(),
});

export type DocumentActorKind = z.infer<typeof documentActorKindSchema>;
export type DocumentKind = z.infer<typeof documentKindSchema>;
export type DocumentRecord = z.infer<typeof documentRecordSchema>;
export type DocumentListItem = z.infer<typeof documentListItemSchema>;
/** What callers send — title/content are optional on the wire (schema defaults apply server-side). */
export type DocumentCreateRequest = z.input<typeof documentCreateRequestSchema>;
export type DocumentUpdateRequest = z.infer<typeof documentUpdateRequestSchema>;
export type DocumentListRequest = z.infer<typeof documentListRequestSchema>;
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type DocumentDetailResponse = z.infer<typeof documentDetailResponseSchema>;
export type DocumentDeleteResponse = z.infer<typeof documentDeleteResponseSchema>;
export type DocumentExportFormat = z.infer<typeof documentExportFormatSchema>;
export type DocumentGoogleDriveExportResponse = z.infer<
	typeof documentGoogleDriveExportResponseSchema
>;
