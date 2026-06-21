"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent } from "@tiptap/react";
import type { DocumentRecord } from "@unison/contracts";
import { useEffect } from "react";

import { CharBudgetMeter } from "@/features/documents/char-budget-meter";
import { DocumentToolbar } from "@/features/documents/document-toolbar";
import { saveStateLabel, useDocumentAutosave } from "@/features/documents/use-document-autosave";
import { useApi } from "@/lib/api-context";
import { Skeleton } from "@/ui/skeleton";
import { AssistantMarkdown } from "../../assistant-markdown";
import type { DocumentModule } from "../types";

// ---------------------------------------------------------------------------
// Document module view (plan §6.6). While the create is still streaming there is
// no durable id yet — show the streamed markdown read-only. Once `document.create`
// completes the real editor mounts (shared `useDocumentAutosave` engine), and a
// later `document.edit` bumps the call count → we reload the server copy.
// ---------------------------------------------------------------------------

export function DocumentModuleView({ module }: { module: DocumentModule }) {
	if (!module.documentId) {
		return (
			<div className="flex-1 overflow-y-auto px-5 py-4">
				<AssistantMarkdown text={module.draftMarkdown || "Writing document…"} />
			</div>
		);
	}

	return (
		<LoadedDocumentModule
			documentId={module.documentId}
			editSignal={module.callIds.length}
			key={module.documentId}
		/>
	);
}

function LoadedDocumentModule({
	documentId,
	editSignal,
}: {
	documentId: string;
	editSignal: number;
}) {
	const api = useApi();
	const queryClient = useQueryClient();

	const documentQuery = useQuery({
		queryFn: () => api.getDocument(documentId),
		queryKey: ["document", documentId],
		staleTime: 5_000,
	});

	// A new agent edit (another call id) means the server content changed — pull
	// it so the open editor reflects it (the autosave hook reconciles dirtiness).
	// biome-ignore lint/correctness/useExhaustiveDependencies: editSignal is the intended re-trigger, not used in the body
	useEffect(() => {
		void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
	}, [editSignal, documentId, queryClient]);

	if (documentQuery.isLoading || !documentQuery.data) {
		if (documentQuery.isError) {
			return (
				<div className="flex-1 px-5 py-4 text-sm text-danger">Failed to load this document.</div>
			);
		}

		return (
			<div className="flex flex-col gap-3 px-5 py-4">
				<Skeleton style={{ height: "28px", width: "100%" }} />
				<Skeleton style={{ height: "240px", width: "100%" }} />
			</div>
		);
	}

	return <DocumentModuleEditor document={documentQuery.data} key={documentId} />;
}

function DocumentModuleEditor({ document }: { document: DocumentRecord }) {
	const { charCount, contentMaxChars, editor, kind, saveState } = useDocumentAutosave(document);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{editor && (
				<div className="flex shrink-0 items-center gap-2 border-b border-(--line) px-3 py-1.5">
					<DocumentToolbar editor={editor} />
					{kind === "profile" && contentMaxChars !== null && (
						<span className="ml-auto shrink-0">
							<CharBudgetMeter count={charCount} max={contentMaxChars} />
						</span>
					)}
					<span
						aria-live="polite"
						className={`shrink-0 text-xs text-ink-subtle ${kind === "profile" && contentMaxChars !== null ? "" : "ml-auto"}`}
					>
						{saveStateLabel(saveState)}
					</span>
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				<EditorContent className="doc-editor" editor={editor} />
			</div>
		</div>
	);
}
