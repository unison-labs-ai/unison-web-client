"use client";

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DocumentExportFormat, DocumentListItem } from "@unison/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/ui/dropdown-menu";
import { Input } from "@/ui/input";

// ---------------------------------------------------------------------------
// Shared document actions: the export menu items and the rename/delete
// dialogs, used by both the list rows and the editor header.
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");

	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

const EXPORT_LABELS: Record<DocumentExportFormat, string> = {
	docx: "Word (.docx)",
	md: "Markdown",
	pdf: "PDF",
};

export function evictDeletedDocument(queryClient: QueryClient, documentId: string): void {
	queryClient.setQueryData<DocumentListItem[]>(["documents"], (documents) =>
		documents?.filter((document) => document.id !== documentId),
	);
	queryClient.removeQueries({ exact: true, queryKey: ["document", documentId] });
}

type DocumentDeleteApi = {
	deleteDocument: (documentId: string) => Promise<void>;
};

export async function deleteDocumentFromDialog({
	api,
	documentId,
	onBeforeDelete,
	onDeleteFailed,
	queryClient,
}: {
	api: DocumentDeleteApi;
	documentId: string;
	onBeforeDelete?: () => void;
	onDeleteFailed?: () => void;
	queryClient: QueryClient;
}): Promise<void> {
	let prepared = false;

	onBeforeDelete?.();
	prepared = true;

	try {
		await queryClient.cancelQueries({ exact: true, queryKey: ["document", documentId] });
		await api.deleteDocument(documentId);
	} catch (error) {
		if (error instanceof WebApiError && error.status === 404) {
			return;
		}

		if (prepared) {
			onDeleteFailed?.();
		}

		throw error;
	}
}

export function useDocumentExport(documentId: string) {
	const api = useApi();

	async function exportFile(format: DocumentExportFormat): Promise<void> {
		const pending = toast.loading(`Exporting ${EXPORT_LABELS[format]}…`);

		try {
			const { blob, filename } = await api.exportDocumentFile(documentId, format);

			downloadBlob(blob, filename);
			toast.success(`Exported ${filename}`, { id: pending });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Export failed.", { id: pending });
		}
	}

	async function exportToGoogleDrive(): Promise<void> {
		const pending = toast.loading("Creating Google Doc…");

		try {
			const result = await api.exportDocumentToGoogleDrive(documentId);

			toast.success("Created in Google Drive", { id: pending });

			if (result.webViewLink) {
				window.open(result.webViewLink, "_blank", "noopener");
			}
		} catch (error) {
			if (
				error instanceof WebApiError &&
				(error.code === "google_not_connected" || error.code === "google_scope_missing")
			) {
				toast.error(error.message, {
					action: { label: "Connections", onClick: () => window.location.assign("/connections") },
					id: pending,
				});
				return;
			}

			toast.error(error instanceof Error ? error.message : "Export failed.", { id: pending });
		}
	}

	return { exportFile, exportToGoogleDrive };
}

/** The export entries of a document dropdown menu (flat items + separator). */
export function DocumentExportMenuItems({ documentId }: { documentId: string }) {
	const { exportFile, exportToGoogleDrive } = useDocumentExport(documentId);

	return (
		<>
			<DropdownMenuItem onSelect={() => void exportFile("md")}>Export as Markdown</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => void exportFile("docx")}>
				Export as Word (.docx)
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => void exportFile("pdf")}>Export as PDF</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => void exportToGoogleDrive()}>
				Export to Google Docs
			</DropdownMenuItem>
			<DropdownMenuSeparator />
		</>
	);
}

export function RenameDocumentDialog({
	documentId,
	initialTitle,
	onOpenChange,
	open,
}: {
	documentId: string;
	initialTitle: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(initialTitle);

	useEffect(() => {
		if (open) {
			setTitle(initialTitle);
		}
	}, [initialTitle, open]);

	const renameMutation = useMutation({
		mutationFn: (nextTitle: string) => api.updateDocument(documentId, { title: nextTitle }),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Rename failed."),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["documents"] });
			void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
			onOpenChange(false);
		},
	});

	function submit() {
		const trimmed = title.trim();

		if (trimmed.length === 0 || trimmed === initialTitle) {
			onOpenChange(false);
			return;
		}

		renameMutation.mutate(trimmed);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename document</DialogTitle>
				</DialogHeader>
				<Input
					autoFocus
					onChange={(event) => setTitle(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							submit();
						}
					}}
					value={title}
				/>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="ghost">
						Cancel
					</Button>
					<Button disabled={renameMutation.isPending} onClick={submit}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function DeleteDocumentDialog({
	documentId,
	onBeforeDelete,
	onDeleteFailed,
	onDeleted,
	onOpenChange,
	open,
	title,
}: {
	documentId: string;
	onBeforeDelete?: () => void;
	onDeleteFailed?: () => void;
	onDeleted?: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const router = useRouter();

	const deleteMutation = useMutation({
		mutationFn: () =>
			deleteDocumentFromDialog({
				api,
				documentId,
				onBeforeDelete,
				onDeleteFailed,
				queryClient,
			}),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed."),
		onSuccess: async () => {
			evictDeletedDocument(queryClient, documentId);
			void queryClient.invalidateQueries({ queryKey: ["documents"] });
			onOpenChange(false);

			if (onDeleted) {
				onDeleted();
			} else {
				router.refresh();
			}
		},
	});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete document</DialogTitle>
					<DialogDescription>
						“{title}” will be removed from your Documents. This can’t be undone from the app.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="ghost">
						Cancel
					</Button>
					<Button
						disabled={deleteMutation.isPending}
						onClick={() => deleteMutation.mutate()}
						variant="destructive"
					>
						{deleteMutation.isPending ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
