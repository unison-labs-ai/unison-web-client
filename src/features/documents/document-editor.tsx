"use client";

import { useQuery } from "@tanstack/react-query";
import { EditorContent } from "@tiptap/react";
import type { DocumentRecord } from "@unison/contracts";
import { ChevronDown, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { ErrorState, PageFade, useHydrated } from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";

import { CharBudgetMeter } from "./char-budget-meter";
import { DeleteDocumentDialog, DocumentExportMenuItems } from "./document-actions";
import { DocumentToolbar } from "./document-toolbar";
import { saveStateLabel, useDocumentAutosave } from "./use-document-autosave";

// ---------------------------------------------------------------------------
// Document editor route — the editing engine + formatting toolbar now live in
// `useDocumentAutosave` / `DocumentToolbar` (shared with the session document
// module, plan M0); this file owns only the page chrome (breadcrumb, save-state,
// export, delete).
// ---------------------------------------------------------------------------

function LoadedDocumentEditor({ document: initial }: { document: DocumentRecord }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const isNewDocument = searchParams.get("new") === "1";

	const [deleteOpen, setDeleteOpen] = useState(false);
	const titleInputRef = useRef<HTMLInputElement | null>(null);

	const {
		charCount,
		commitTitle,
		contentMaxChars,
		editor,
		kind,
		prepareForDelete,
		resumeAfterDeleteFailure,
		saveState,
		setTitle,
		title,
	} = useDocumentAutosave(initial);

	// New documents land with the title selected, ready to be named.
	useEffect(() => {
		if (isNewDocument) {
			titleInputRef.current?.focus();
			titleInputRef.current?.select();
		}
	}, [isNewDocument]);

	return (
		<PageShell reserveTopActions>
			<PageFade>
				{/* Header: Documents / {title} + save state + export + overflow */}
				<div className="mb-5 flex min-h-10 items-center justify-between gap-3 md:pr-[var(--app-top-actions-reserve)]">
					<nav
						aria-label="Breadcrumb"
						className="flex min-w-0 flex-1 items-center gap-[7px] text-sm"
					>
						<Link
							className="shrink-0 text-ink-subtle no-underline hover:text-ink-muted"
							href="/documents"
							style={{ fontWeight: 400 }}
						>
							Documents
						</Link>
						<span aria-hidden className="shrink-0 text-ink-subtle">
							/
						</span>
						<input
							aria-label="Document title"
							className="m-0 w-full min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-ink outline-none"
							onBlur={commitTitle}
							onChange={(event) => setTitle(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									event.currentTarget.blur();
								}
							}}
							ref={titleInputRef}
							style={{ fontWeight: 500 }}
							value={title}
						/>
					</nav>

					<div className="flex shrink-0 items-center gap-2">
						{kind === "profile" && contentMaxChars !== null && (
							<CharBudgetMeter count={charCount} max={contentMaxChars} />
						)}
						<span aria-live="polite" className="text-xs text-ink-subtle">
							{saveStateLabel(saveState)}
						</span>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="sm" variant="secondary">
									Export
									<ChevronDown size={13} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DocumentExportMenuItems documentId={initial.id} />
								<DropdownMenuItem onSelect={() => router.push("/documents")}>
									Back to documents
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button aria-label="Document actions" size="icon" variant="ghost">
									<MoreVertical size={15} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem className="text-danger" onSelect={() => setDeleteOpen(true)}>
									Delete…
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Formatting toolbar */}
				{editor && (
					<div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-0.5 rounded-lg border border-(--border) bg-surface px-1.5 py-1">
						<DocumentToolbar editor={editor} />
					</div>
				)}

				<EditorContent className="doc-editor" editor={editor} />
			</PageFade>

			<DeleteDocumentDialog
				documentId={initial.id}
				onBeforeDelete={prepareForDelete}
				onDeleteFailed={resumeAfterDeleteFailure}
				onDeleted={() => router.push("/documents")}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				title={title}
			/>
		</PageShell>
	);
}

function EditorSkeleton() {
	return (
		<PageShell>
			<div className="flex flex-col gap-4">
				<Skeleton style={{ height: "20px", width: "40%" }} />
				<Skeleton style={{ height: "36px", width: "100%" }} />
				<Skeleton style={{ height: "320px", width: "100%" }} />
			</div>
		</PageShell>
	);
}

export function DocumentEditor({ documentId }: { documentId: string }) {
	const api = useApi();
	const hydrated = useHydrated();

	const documentQuery = useQuery({
		queryFn: () => api.getDocument(documentId),
		queryKey: ["document", documentId],
		staleTime: 5_000,
	});

	if (!hydrated || documentQuery.isLoading) {
		return <EditorSkeleton />;
	}

	if (documentQuery.isError || !documentQuery.data) {
		return (
			<PageShell title="Document">
				<ErrorState
					message="Failed to load this document."
					onRetry={() => void documentQuery.refetch()}
				/>
			</PageShell>
		);
	}

	// Key by id so navigating between documents rebuilds the editor state.
	return <LoadedDocumentEditor document={documentQuery.data} key={documentId} />;
}
