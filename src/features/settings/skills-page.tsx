"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SkillListItem } from "@unison/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CliConnectSection } from "@/features/settings/cli-connect-section";
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
import { Input } from "@/ui/input";
import { EmptyState, ErrorState, PageFade, PageSection, useHydrated } from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Toggle } from "@/ui/toggle";

// ---------------------------------------------------------------------------
// Skills settings — reusable instructions the assistant loads on demand. A
// deliberately simple table (title + description, an enabled toggle, and a
// delete action); rows open the same modal editor the "New skill" button does.
// Mirrors the Documents feature's conventions (React Query + the shared
// Dialog/Input/Toggle primitives) since there is no /ui textarea primitive —
// the body uses a raw <textarea> styled to match the Input primitive.
// ---------------------------------------------------------------------------

const TEXTAREA_CLASS =
	"flex min-h-[200px] w-full rounded-md border border-(--border) bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-50";

/**
 * Shared create/edit dialog. With no `skillId` it creates; with one it loads
 * the full skill (list rows omit `bodyMd`) and saves with the row's `version`
 * as the optimistic-concurrency token.
 */
function SkillEditorDialog({
	onOpenChange,
	open,
	skillId,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/** Undefined → create mode; set → edit the existing skill. */
	skillId?: string;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const isEdit = skillId !== undefined;

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [bodyMd, setBodyMd] = useState("");

	// In edit mode, fetch the full record (list items omit the body).
	const skillQuery = useQuery({
		enabled: open && isEdit,
		queryFn: () => api.getSkill(skillId as string),
		queryKey: ["skill", skillId],
	});

	// Seed the form: from the fetched skill (edit) or blank (create) each open.
	useEffect(() => {
		if (!open) {
			return;
		}

		if (isEdit) {
			if (skillQuery.data) {
				setTitle(skillQuery.data.title);
				setDescription(skillQuery.data.description);
				setBodyMd(skillQuery.data.bodyMd);
			}
		} else {
			setTitle("");
			setDescription("");
			setBodyMd("");
		}
	}, [isEdit, open, skillQuery.data]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			const trimmedTitle = title.trim();

			if (isEdit) {
				return api.updateSkill(skillId as string, {
					baseVersion: skillQuery.data?.version,
					bodyMd,
					description: description.trim(),
					title: trimmedTitle,
				});
			}

			return api.createSkill({
				bodyMd,
				description: description.trim(),
				title: trimmedTitle.length > 0 ? trimmedTitle : undefined,
			});
		},
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Couldn't save the skill."),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["skills"] });
			if (isEdit) {
				void queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
			}
			toast.success(isEdit ? "Skill saved." : "Skill created.");
			onOpenChange(false);
		},
	});

	const loadingExisting = isEdit && skillQuery.isLoading;
	const saveDisabled = saveMutation.isPending || loadingExisting || title.trim().length === 0;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit skill" : "New skill"}</DialogTitle>
					<DialogDescription>
						A skill is reusable instructions your assistant loads on demand.
					</DialogDescription>
				</DialogHeader>

				{isEdit && skillQuery.isError ? (
					<ErrorState
						message="Failed to load this skill."
						onRetry={() => void skillQuery.refetch()}
					/>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<label
							htmlFor="skill-title"
							style={{ display: "flex", flexDirection: "column", gap: "4px" }}
						>
							<span style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500 }}>Title</span>
							<Input
								autoFocus={!isEdit}
								disabled={loadingExisting}
								id="skill-title"
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Weekly report style"
								value={title}
							/>
						</label>

						<label
							htmlFor="skill-description"
							style={{ display: "flex", flexDirection: "column", gap: "4px" }}
						>
							<span style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500 }}>
								When to use it
							</span>
							<Input
								disabled={loadingExisting}
								id="skill-description"
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Use when drafting the Monday status update."
								value={description}
							/>
						</label>

						<label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
							<span style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500 }}>
								Instructions
							</span>
							<textarea
								className={TEXTAREA_CLASS}
								disabled={loadingExisting}
								onChange={(event) => setBodyMd(event.target.value)}
								placeholder="Write the skill body in Markdown…"
								value={bodyMd}
							/>
						</label>
					</div>
				)}

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="ghost">
						Cancel
					</Button>
					<Button disabled={saveDisabled} onClick={() => saveMutation.mutate()}>
						{saveMutation.isPending ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeleteSkillDialog({
	onOpenChange,
	open,
	skillId,
	title,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	skillId: string;
	title: string;
}) {
	const api = useApi();
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: () => api.deleteSkill(skillId),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed."),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["skills"] });
			toast.success("Skill deleted.");
			onOpenChange(false);
		},
	});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete skill</DialogTitle>
					<DialogDescription>
						“{title}” will be removed from your Skills. This can’t be undone from the app.
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
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SkillRow({ skill }: { skill: SkillListItem }) {
	const api = useApi();
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const toggleMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			api.updateSkill(skill.id, { baseVersion: skill.version, enabled }),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Couldn't update the skill."),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["skills"] });
			void queryClient.invalidateQueries({ queryKey: ["skill", skill.id] });
		},
	});

	return (
		<>
			<TableRow
				className="cursor-pointer transition-colors hover:bg-primary-soft"
				onClick={() => setEditOpen(true)}
			>
				<TableCell className="max-w-0 w-full">
					<span className="block truncate font-medium text-ink" title={skill.title}>
						{skill.title}
					</span>
					{skill.description ? (
						<span className="block truncate text-ink-subtle" title={skill.description}>
							{skill.description}
						</span>
					) : (
						<span className="block text-ink-subtle">No description</span>
					)}
				</TableCell>
				<TableCell className="w-10 py-0 text-center">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: scoped click-trap so the toggle doesn't open the editor */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: the trap only stops bubbling; the focusable toggle inside handles keyboard */}
					<div onClick={(event) => event.stopPropagation()}>
						<Toggle
							aria-label={skill.enabled ? `Disable ${skill.title}` : `Enable ${skill.title}`}
							checked={skill.enabled}
							disabled={toggleMutation.isPending}
							onCheckedChange={(next) => toggleMutation.mutate(next)}
						/>
					</div>
				</TableCell>
				<TableCell className="w-10 py-0 text-right">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: scoped click-trap so the action buttons don't open the editor */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: the trap only stops bubbling; the focusable buttons inside handle keyboard */}
					<div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
						<Button
							aria-label={`Edit ${skill.title}`}
							onClick={() => setEditOpen(true)}
							size="icon"
							variant="ghost"
						>
							<Pencil size={15} />
						</Button>
						<Button
							aria-label={`Delete ${skill.title}`}
							className="text-danger"
							onClick={() => setDeleteOpen(true)}
							size="icon"
							variant="ghost"
						>
							<Trash2 size={15} />
						</Button>
					</div>
				</TableCell>
			</TableRow>

			<SkillEditorDialog onOpenChange={setEditOpen} open={editOpen} skillId={skill.id} />
			<DeleteSkillDialog
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				skillId={skill.id}
				title={skill.title}
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

export function SkillsPage() {
	const api = useApi();
	const hydrated = useHydrated();
	const [createOpen, setCreateOpen] = useState(false);

	const skillsQuery = useQuery({
		queryFn: () => api.listSkills(),
		queryKey: ["skills"],
		staleTime: 15_000,
	});

	const skills = skillsQuery.data ?? [];
	const pending = !hydrated || skillsQuery.isLoading;

	return (
		<PageFade>
			<PageSection
				actions={
					<Button onClick={() => setCreateOpen(true)} size="sm">
						<Plus size={14} />
						New skill
					</Button>
				}
				description="Skills — reusable instructions your assistant loads on demand."
				title="Skills"
			>
				{pending && <ListSkeleton />}

				{!pending && skillsQuery.isError && (
					<ErrorState message="Failed to load skills." onRetry={() => void skillsQuery.refetch()} />
				)}

				{!pending && !skillsQuery.isError && skills.length === 0 && (
					<EmptyState message="No skills yet. Create one here, or ask your agent to write one." />
				)}

				{!pending && !skillsQuery.isError && skills.length > 0 && (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Skill</TableHead>
								<TableHead className="text-center">Enabled</TableHead>
								<TableHead aria-label="Actions" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{skills.map((skill) => (
								<SkillRow key={skill.id} skill={skill} />
							))}
						</TableBody>
					</Table>
				)}
			</PageSection>

			<div className="mt-10">
				<CliConnectSection />
			</div>

			<SkillEditorDialog onOpenChange={setCreateOpen} open={createOpen} />
		</PageFade>
	);
}
