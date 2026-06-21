import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { type DocumentListItem, documentListItemSchema } from "@unison/contracts";
import { WebApiError } from "@/lib/api";

import { deleteDocumentFromDialog, evictDeletedDocument } from "./document-actions";

const DOCUMENT_ID = "00000000-0000-4000-8000-00000000000a";
const OTHER_DOCUMENT_ID = "00000000-0000-4000-8000-00000000000b";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const ISO = "2026-06-09T10:00:00.000Z";

function documentListItem(id: string, title: string): DocumentListItem {
	return documentListItemSchema.parse({
		contentLength: 0,
		contentMaxChars: null,
		createdAt: ISO,
		createdByKind: "user",
		id,
		kind: "standard",
		lastEditedByKind: "user",
		sourceSessionId: null,
		tenantId: TENANT_ID,
		title,
		updatedAt: ISO,
		userId: USER_ID,
		version: 1,
	});
}

describe("evictDeletedDocument", () => {
	it("removes the deleted document from list and detail caches", () => {
		const queryClient = new QueryClient();
		const deleted = documentListItem(DOCUMENT_ID, "Doomed");
		const retained = documentListItem(OTHER_DOCUMENT_ID, "Keep me");

		queryClient.setQueryData(["documents"], [deleted, retained]);
		queryClient.setQueryData(["document", DOCUMENT_ID], { document: deleted });

		evictDeletedDocument(queryClient, DOCUMENT_ID);

		const cachedDocuments = queryClient.getQueryData(["documents"]) as DocumentListItem[];
		expect(cachedDocuments.map((document) => document.id)).toEqual([OTHER_DOCUMENT_ID]);
		expect(queryClient.getQueryData(["document", DOCUMENT_ID])).toBeUndefined();
	});
});

describe("deleteDocumentFromDialog", () => {
	it("treats a 404 as already deleted without running the failure reset", async () => {
		const calls: string[] = [];

		await deleteDocumentFromDialog({
			api: {
				deleteDocument: async () => {
					throw new WebApiError("Document was not found.", 404, "not_found");
				},
			},
			documentId: DOCUMENT_ID,
			onBeforeDelete: () => calls.push("before"),
			onDeleteFailed: () => calls.push("failed"),
			queryClient: new QueryClient(),
		});

		expect(calls).toEqual(["before"]);
	});

	it("runs the failure reset when delete fails after preparation", async () => {
		const calls: string[] = [];
		let caught: unknown;

		try {
			await deleteDocumentFromDialog({
				api: {
					deleteDocument: async () => {
						throw new WebApiError("Request timed out.", 408, "request_timeout");
					},
				},
				documentId: DOCUMENT_ID,
				onBeforeDelete: () => calls.push("before"),
				onDeleteFailed: () => calls.push("failed"),
				queryClient: new QueryClient(),
			});
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(WebApiError);
		expect(calls).toEqual(["before", "failed"]);
	});
});
