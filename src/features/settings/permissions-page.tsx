"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AgentToolPermission,
	AgentToolPermissionDecision,
	AgentToolSideEffectClass,
	ToolCatalogEntryWithAvailability,
	ToolPolicyMode,
} from "@unison/contracts";
import { Lock } from "lucide-react";
import { useMemo } from "react";
import { useApi } from "@/lib/api-context";
import {
	EmptyState,
	ErrorState,
	GroupCard,
	GroupCardSkeleton,
	GroupRow,
	PageFade,
	PageSection,
	SegmentedControl,
	useHydrated,
} from "@/ui/page-blocks";

const PERMISSION_OPTIONS: { label: string; value: AgentToolPermissionDecision }[] = [
	{ label: "Allow", value: "always_allow" },
	{ label: "Require approval", value: "ask_for_approval" },
	{ label: "Deny", value: "always_reject" },
];

/**
 * Least → most dangerous. Mirrors the declaration order of
 * agentToolSideEffectClassSchema in @unison/contracts.
 */
const SIDE_EFFECT_CLASS_ORDER: AgentToolSideEffectClass[] = [
	"read",
	"internal_write",
	"external_draft",
	"external_send",
	"external_write",
	"destructive",
];

const SIDE_EFFECT_CLASS_COPY: Record<
	AgentToolSideEffectClass,
	{ description: string; label: string }
> = {
	destructive: {
		description: "Permanently deletes or overwrites data. The hardest actions to undo.",
		label: "Destructive",
	},
	external_draft: {
		description: "Prepares drafts in connected services. Nothing is sent or published.",
		label: "External draft",
	},
	external_send: {
		description: "Sends messages to other people through connected services, on your behalf.",
		label: "External send",
	},
	external_write: {
		description: "Creates or changes data in connected external services.",
		label: "External write",
	},
	internal_write: {
		description: "Creates or edits data inside your Unison workspace. Nothing leaves Unison.",
		label: "Internal write",
	},
	read: {
		description: "Looks things up. Reads your data without changing anything.",
		label: "Read",
	},
};

type PermissionRowModel = {
	description: string | null;
	/** Saved permission for a tool that is no longer in the catalog. */
	isOrphan: boolean;
	permission: AgentToolPermissionDecision;
	policyMode: ToolPolicyMode;
	title: string;
	toolName: string;
};

type PermissionGroup = {
	description: string;
	key: string;
	label: string;
	rows: PermissionRowModel[];
};

/**
 * Joins the tool catalog with the per-user permission rows. Catalog tools
 * without an override render at their catalog default (the PUT endpoint
 * upserts, so changing them creates the override). Permission rows for tools
 * that are no longer in the catalog land in a trailing "Other" group and
 * render read-only — the PUT endpoint rejects unknown tool names.
 */
function buildGroups(
	tools: ToolCatalogEntryWithAvailability[],
	permissions: AgentToolPermission[],
): PermissionGroup[] {
	const permissionByTool = new Map(permissions.map((row) => [row.toolName, row]));
	const rowsByClass = new Map<AgentToolSideEffectClass, PermissionRowModel[]>();

	for (const tool of tools) {
		const override = permissionByTool.get(tool.name);
		const row: PermissionRowModel = {
			description: tool.description,
			isOrphan: false,
			permission: override?.permission ?? tool.defaultPermission,
			policyMode: tool.policyMode,
			title: tool.title || tool.name,
			toolName: tool.name,
		};
		const rows = rowsByClass.get(tool.sideEffectClass) ?? [];
		rows.push(row);
		rowsByClass.set(tool.sideEffectClass, rows);
	}

	const catalogNames = new Set(tools.map((tool) => tool.name));
	const orphanRows = permissions
		.filter((row) => !catalogNames.has(row.toolName))
		.map(
			(row): PermissionRowModel => ({
				description: null,
				isOrphan: true,
				permission: row.permission,
				policyMode: "user_toggleable",
				title: row.toolName,
				toolName: row.toolName,
			}),
		);

	const groups: PermissionGroup[] = [];
	for (const sideEffectClass of SIDE_EFFECT_CLASS_ORDER) {
		const rows = rowsByClass.get(sideEffectClass);
		if (!rows || rows.length === 0) {
			continue;
		}
		rows.sort((a, b) => a.title.localeCompare(b.title));
		groups.push({
			description: SIDE_EFFECT_CLASS_COPY[sideEffectClass].description,
			key: sideEffectClass,
			label: SIDE_EFFECT_CLASS_COPY[sideEffectClass].label,
			rows,
		});
	}

	if (orphanRows.length > 0) {
		orphanRows.sort((a, b) => a.title.localeCompare(b.title));
		groups.push({
			description: "Saved permissions for tools that are not in the current catalog.",
			key: "other",
			label: "Other",
			rows: orphanRows,
		});
	}

	return groups;
}

function FloorNote({ text }: { text: string }) {
	return (
		<span
			style={{
				alignItems: "center",
				color: "var(--ink-subtle)",
				display: "inline-flex",
				fontSize: "11px",
				gap: "4px",
			}}
		>
			<Lock size={11} strokeWidth={2} />
			{text}
		</span>
	);
}

function PermissionRow({ row }: { row: PermissionRowModel }) {
	const api = useApi();
	const queryClient = useQueryClient();

	const updateMutation = useMutation({
		mutationFn: (permission: AgentToolPermissionDecision) =>
			api.updateToolPermission(row.toolName, { permission }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["tool-permissions"] });
		},
	});

	const isFixed = row.policyMode === "fixed";
	const isApprovalFloor = row.policyMode === "required";
	// Orphan rows are read-only: the PUT endpoint 400s on tool names that are
	// not in the current catalog, so offering the buttons would only fail.
	const isReadOnly = isFixed || row.isOrphan;

	return (
		<GroupRow description={row.description ?? undefined} title={row.title}>
			<SegmentedControl
				disabled={updateMutation.isPending || isReadOnly}
				// "required" tools must at least ask for approval, so the only
				// option below the floor is autonomous Allow.
				isOptionDisabled={(value) => isApprovalFloor && value === "always_allow"}
				onChange={(value) => void updateMutation.mutate(value)}
				options={PERMISSION_OPTIONS}
				value={row.permission}
			/>
			{isFixed && <FloorNote text="Fixed — security floor" />}
			{isApprovalFloor && <FloorNote text="Floor: approval required" />}
			{row.isOrphan && (
				<span style={{ color: "var(--ink-subtle)", fontSize: "11px" }}>
					Unknown tool — not in the current catalog
				</span>
			)}
			{updateMutation.isError && (
				<span style={{ color: "var(--danger)", fontSize: "11px" }}>Update failed</span>
			)}
		</GroupRow>
	);
}

export function PermissionsPage() {
	const api = useApi();

	const permissionsQuery = useQuery({
		queryFn: () => api.listToolPermissions(),
		queryKey: ["tool-permissions"],
		staleTime: 30_000,
	});

	const catalogQuery = useQuery({
		queryFn: () => api.listTools(),
		queryKey: ["tool-catalog"],
		staleTime: 30_000,
	});

	// SSR always renders the pending branch — hold it until hydration is done.
	const hydrated = useHydrated();
	const isError = hydrated && (permissionsQuery.isError || catalogQuery.isError);
	const isLoading =
		!hydrated || (!isError && (permissionsQuery.isLoading || catalogQuery.isLoading));

	const tools = catalogQuery.data?.tools;
	const permissions = permissionsQuery.data?.permissions;

	const groups = useMemo(() => buildGroups(tools ?? [], permissions ?? []), [tools, permissions]);

	const retry = () => {
		if (permissionsQuery.isError) {
			void permissionsQuery.refetch();
		}
		if (catalogQuery.isError) {
			void catalogQuery.refetch();
		}
	};

	return (
		<PageFade>
			<PageSection
				description="Per-tool autonomy, grouped by side-effect class. These defaults apply to all sessions and automations; security floors cannot be loosened."
				title="Default tool permissions"
			>
				{isLoading && <GroupCardSkeleton controlWidth={230} rows={4} />}
				{isError && <ErrorState message="Failed to load tool permissions." onRetry={retry} />}
				{!isLoading && !isError && groups.length === 0 && (
					<EmptyState message="No tools available" />
				)}
			</PageSection>

			{!isLoading &&
				!isError &&
				groups.map((group) => (
					<PageSection description={group.description} key={group.key} title={group.label}>
						<GroupCard>
							{group.rows.map((row) => (
								<PermissionRow key={row.toolName} row={row} />
							))}
						</GroupCard>
					</PageSection>
				))}
		</PageFade>
	);
}
