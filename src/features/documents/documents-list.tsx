"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { DocumentListItem } from "@unison/contracts";
import { MoreVertical, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { relativeTime } from "@/lib/relative-time";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { EmptyState, ErrorState, PageFade, useHydrated } from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";

import {
	DeleteDocumentDialog,
	DocumentExportMenuItems,
	RenameDocumentDialog,
} from "./document-actions";

// ---------------------------------------------------------------------------
// Documents list — a deliberately simple table (screens.md Documents): title,
// last edited, created, and a per-row overflow menu. Rows open the editor.
// ---------------------------------------------------------------------------

function DocumentRow({ document }: { document: DocumentListItem }) {
	const router = useRouter();
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	return (
		<>
			<TableRow
				className="cursor-pointer transition-colors hover:bg-primary-soft"
				onClick={() => router.push(`/documents/${document.id}`)}
			>
				<TableCell className="max-w-0 w-full">
					<span className="block truncate font-medium text-ink" title={document.title}>
						{document.title}
					</span>
				</TableCell>
				<TableCell className="whitespace-nowrap text-ink-subtle">
					{relativeTime(document.updatedAt)}
					{document.lastEditedByKind === "agent" && (
						<span className="text-ink-subtle"> · agent</span>
					)}
				</TableCell>
				<TableCell className="whitespace-nowrap text-ink-subtle">
					{relativeTime(document.createdAt)}
				</TableCell>
				<TableCell className="w-10 py-0 text-right">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: scoped click-trap so menu taps don't navigate the row */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: the trap only stops bubbling; keyboard users interact with the focusable menu button inside */}
					<div onClick={(event) => event.stopPropagation()}>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button aria-label={`Actions for ${document.title}`} size="icon" variant="ghost">
									<MoreVertical size={15} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => router.push(`/documents/${document.id}`)}>
									Open
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setRenameOpen(true)}>Rename…</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DocumentExportMenuItems documentId={document.id} />
								<DropdownMenuItem className="text-danger" onSelect={() => setDeleteOpen(true)}>
									Delete…
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</TableCell>
			</TableRow>

			<RenameDocumentDialog
				documentId={document.id}
				initialTitle={document.title}
				onOpenChange={setRenameOpen}
				open={renameOpen}
			/>
			<DeleteDocumentDialog
				documentId={document.id}
				onDeleted={() => undefined}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				title={document.title}
			/>
		</>
	);
}

function ListSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			{[1, 2, 3, 4, 5].map((i) => (
				<Skeleton key={i} style={{ height: "40px", width: "100%" }} />
			))}
		</div>
	);
}

export function DocumentsList() {
	const api = useApi();
	const router = useRouter();
	const hydrated = useHydrated();

	const documentsQuery = useQuery({
		queryFn: () => api.listDocuments(),
		queryKey: ["documents"],
		staleTime: 15_000,
	});

	const createMutation = useMutation({
		mutationFn: () => api.createDocument(),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Couldn't create the document."),
		onSuccess: (document) => router.push(`/documents/${document.id}?new=1`),
	});

	const documents = documentsQuery.data ?? [];
	const pending = !hydrated || documentsQuery.isLoading;

	return (
		<PageShell
			actions={
				<Button
					disabled={createMutation.isPending}
					onClick={() => createMutation.mutate()}
					size="sm"
				>
					<Plus size={14} />
					New document
				</Button>
			}
			title="Documents"
		>
			<PageFade>
				{pending && <ListSkeleton />}

				{!pending && documentsQuery.isError && (
					<ErrorState
						message="Failed to load documents."
						onRetry={() => void documentsQuery.refetch()}
					/>
				)}

				{!pending && !documentsQuery.isError && documents.length === 0 && (
					<EmptyState message="No documents yet. Create one here, or ask your agent to write one." />
				)}

				{!pending && !documentsQuery.isError && documents.length > 0 && (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Title</TableHead>
								<TableHead>Last edited</TableHead>
								<TableHead>Created</TableHead>
								<TableHead aria-label="Actions" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{documents.map((document) => (
								<DocumentRow document={document} key={document.id} />
							))}
						</TableBody>
					</Table>
				)}
			</PageFade>
		</PageShell>
	);
}
