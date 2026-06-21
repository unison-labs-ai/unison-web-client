"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { DocumentRecord } from "@unison/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "./markdown-bridge";

// ---------------------------------------------------------------------------
// Shared document editor engine (plan M0). TipTap over canonical markdown with
// debounced autosave that carries baseVersion; a stale write reloads the server
// copy instead of clobbering, and a focus refetch swaps in a newer agent edit
// when the editor is clean. Both the full-page route and the session module
// panel mount this hook so the load/save/409/refetch behavior lives in one place.
// ---------------------------------------------------------------------------

const AUTOSAVE_DEBOUNCE_MS = 800;

export type SaveState = "error" | "idle" | "saved" | "saving";

export function saveStateLabel(state: SaveState): string {
	switch (state) {
		case "saving":
			return "Saving…";
		case "saved":
			return "Saved";
		case "error":
			return "Couldn't save";
		default:
			return "";
	}
}

export interface DocumentAutosave {
	commitTitle: () => void;
	editor: Editor | null;
	prepareForDelete: () => void;
	resumeAfterDeleteFailure: () => void;
	saveState: SaveState;
	setTitle: (title: string) => void;
	title: string;
	/** Live canonical-markdown length, matching what the server counts. */
	charCount: number;
	/** Per-row budget for special docs (profile/working_memory); null otherwise. */
	contentMaxChars: number | null;
	kind: DocumentRecord["kind"];
}

export function useDocumentAutosave(initial: DocumentRecord): DocumentAutosave {
	const api = useApi();
	const queryClient = useQueryClient();

	const [title, setTitle] = useState(initial.title);
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [charCount, setCharCount] = useState(initial.content.length);

	const versionRef = useRef(initial.version);
	const lastSavedMarkdownRef = useRef<string | null>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savingRef = useRef(false);
	const deletingRef = useRef(false);
	const persistRef = useRef<() => void>(() => {});

	// Stable scheduler; the latest persist implementation lives in persistRef.
	const scheduleSave = useCallback(() => {
		if (deletingRef.current) {
			return;
		}

		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}

		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null;
			persistRef.current();
		}, AUTOSAVE_DEBOUNCE_MS);
	}, []);

	const editor = useEditor({
		content: markdownToEditorHtml(initial.content),
		extensions: [StarterKit],
		immediatelyRender: false,
		onCreate: ({ editor: created }) => {
			// Baseline = the round-tripped serialization, so pure markdown
			// normalization never counts as a user edit.
			lastSavedMarkdownRef.current = editorHtmlToMarkdown(created.getHTML());
		},
		onUpdate: ({ editor: updated }) => {
			setCharCount(editorHtmlToMarkdown(updated.getHTML()).length);
			scheduleSave();
		},
		shouldRerenderOnTransaction: true,
	});

	const persistContent = useCallback(async () => {
		if (!editor || editor.isDestroyed || savingRef.current || deletingRef.current) {
			return;
		}

		const markdown = editorHtmlToMarkdown(editor.getHTML());

		if (markdown === lastSavedMarkdownRef.current) {
			return;
		}

		// Client-side budget guard for the special memory docs: block the save (the
		// server enforces it too) and tell the user to trim rather than silently
		// losing the overflow on reload.
		if (initial.contentMaxChars !== null && markdown.length > initial.contentMaxChars) {
			setSaveState("error");
			toast.error(
				`This document is limited to ${initial.contentMaxChars.toLocaleString()} characters — trim it to save.`,
			);
			return;
		}

		savingRef.current = true;
		setSaveState("saving");

		try {
			const updated = await api.updateDocument(initial.id, {
				baseVersion: versionRef.current,
				content: markdown,
			});

			versionRef.current = updated.version;
			lastSavedMarkdownRef.current = markdown;
			setSaveState("saved");
			void queryClient.invalidateQueries({ queryKey: ["documents"] });
		} catch (error) {
			if (error instanceof WebApiError && error.status === 409) {
				// Someone (usually the agent) wrote a newer version. Reload it —
				// last-writer-wins with a visible reload beats silent clobbering.
				const fresh = await api.getDocument(initial.id).catch(() => null);

				if (fresh && editor && !editor.isDestroyed) {
					editor.commands.setContent(markdownToEditorHtml(fresh.content));
					versionRef.current = fresh.version;
					lastSavedMarkdownRef.current = editorHtmlToMarkdown(editor.getHTML());
					setTitle(fresh.title);
				}

				setSaveState("idle");
				toast.error("This document was updated elsewhere — reloaded the latest version.");
			} else {
				setSaveState("error");
				toast.error(error instanceof Error ? error.message : "Couldn't save the document.");
			}
		} finally {
			savingRef.current = false;

			// Content may have changed while the request was in flight.
			if (
				!deletingRef.current &&
				editor &&
				!editor.isDestroyed &&
				editorHtmlToMarkdown(editor.getHTML()) !== lastSavedMarkdownRef.current
			) {
				scheduleSave();
			}
		}
	}, [api, editor, initial.contentMaxChars, initial.id, queryClient, scheduleSave]);

	useEffect(() => {
		persistRef.current = () => void persistContent();
	}, [persistContent]);

	// Flush a pending save when unmounting (route change or tab close).
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;

				if (!deletingRef.current) {
					persistRef.current();
				}
			}
		};
	}, []);

	// Freshness without a sync engine: when a focus refetch returns a newer
	// version and the editor has no unsaved changes, swap in the server copy.
	const documentQuery = useQuery({
		enabled: Boolean(editor),
		queryFn: () => api.getDocument(initial.id),
		queryKey: ["document", initial.id],
		refetchOnWindowFocus: true,
		staleTime: 5_000,
	});

	useEffect(() => {
		const fresh = documentQuery.data;

		if (
			deletingRef.current ||
			!editor ||
			editor.isDestroyed ||
			!fresh ||
			fresh.version <= versionRef.current
		) {
			return;
		}

		const dirty = editorHtmlToMarkdown(editor.getHTML()) !== lastSavedMarkdownRef.current;

		if (dirty || savingRef.current) {
			return;
		}

		editor.commands.setContent(markdownToEditorHtml(fresh.content));
		versionRef.current = fresh.version;
		lastSavedMarkdownRef.current = editorHtmlToMarkdown(editor.getHTML());
		setTitle(fresh.title);
	}, [documentQuery.data, editor]);

	const commitTitle = useCallback(() => {
		if (deletingRef.current) {
			return;
		}

		const trimmed = title.trim();

		if (trimmed.length === 0) {
			setTitle(initial.title);
			return;
		}

		void api
			.updateDocument(initial.id, { title: trimmed })
			.then(() => {
				void queryClient.invalidateQueries({ queryKey: ["documents"] });
				void queryClient.invalidateQueries({ queryKey: ["document", initial.id] });
			})
			.catch((error) =>
				toast.error(error instanceof Error ? error.message : "Couldn't rename the document."),
			);
	}, [api, initial.id, initial.title, queryClient, title]);

	const prepareForDelete = useCallback(() => {
		deletingRef.current = true;

		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
		}

		setSaveState("idle");
	}, []);

	const resumeAfterDeleteFailure = useCallback(() => {
		deletingRef.current = false;

		if (
			editor &&
			!editor.isDestroyed &&
			editorHtmlToMarkdown(editor.getHTML()) !== lastSavedMarkdownRef.current
		) {
			scheduleSave();
		}
	}, [editor, scheduleSave]);

	return {
		charCount,
		commitTitle,
		contentMaxChars: initial.contentMaxChars,
		editor,
		kind: initial.kind,
		prepareForDelete,
		resumeAfterDeleteFailure,
		saveState,
		setTitle,
		title,
	};
}
