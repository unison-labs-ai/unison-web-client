"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AgentToolPermission,
	AgentToolPermissionDecision,
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

type PermissionRowModel = {
	canAlwaysAllow: boolean;
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

const TOOLSET_LABELS: Record<string, string> = {
	artifact: "Artifacts",
	brain: "Brain",
	calendar: "Calendar",
	capture: "Captures",
	docs: "Docs",
	drive: "Drive",
	email: "Email drafts",
	gmail: "Gmail",
	memory: "Memory",
	notification: "Notifications",
	people: "People",
	reminder: "Reminders",
	sandbox: "Code",
	scheduled_session: "Scheduling",
	sheets: "Sheets",
	web: "Web",
};

function titleizeToolset(id: string): string {
	return TOOLSET_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1).replaceAll("_", " ");
}

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
	const groupsByToolset = new Map<string, PermissionGroup>();

	for (const tool of tools) {
		const override = permissionByTool.get(tool.name);
		const row: PermissionRowModel = {
			canAlwaysAllow: tool.canAlwaysAllow,
			description: tool.description,
			isOrphan: false,
			permission: override?.permission ?? tool.defaultPermission,
			policyMode: tool.policyMode,
			title: tool.title || tool.name,
			toolName: tool.name,
		};
		const group = groupsByToolset.get(tool.toolsetId) ?? {
			description: `Default permissions for ${tool.displayGroup ?? titleizeToolset(tool.toolsetId)} tools.`,
			key: tool.toolsetId,
			label: tool.displayGroup ?? titleizeToolset(tool.toolsetId),
			rows: [],
		};
		group.rows.push(row);
		groupsByToolset.set(tool.toolsetId, group);
	}

	const catalogNames = new Set(tools.map((tool) => tool.name));
	const orphanRows = permissions
		.filter((row) => !catalogNames.has(row.toolName))
		.map(
			(row): PermissionRowModel => ({
				canAlwaysAllow: true,
				description: null,
				isOrphan: true,
				permission: row.permission,
				policyMode: "user_toggleable",
				title: row.toolName,
				toolName: row.toolName,
			}),
		);

	const groups = [...groupsByToolset.values()];
	for (const group of groups) {
		group.rows.sort((a, b) => a.title.localeCompare(b.title));
	}
	groups.sort((a, b) => a.label.localeCompare(b.label));

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

function PolicyNote({ text }: { text: string }) {
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
	const blocksAlwaysAllow = !row.canAlwaysAllow || row.policyMode === "required";
	// Orphan rows are read-only: the PUT endpoint 400s on tool names that are
	// not in the current catalog, so offering the buttons would only fail.
	const isReadOnly = isFixed || row.isOrphan;

	return (
		<GroupRow description={row.description ?? undefined} title={row.title}>
			<SegmentedControl
				disabled={updateMutation.isPending || isReadOnly}
				isOptionDisabled={(value) => blocksAlwaysAllow && value === "always_allow"}
				onChange={(value) => void updateMutation.mutate(value)}
				options={PERMISSION_OPTIONS}
				value={row.permission}
			/>
			{isFixed && <PolicyNote text="Fixed tool" />}
			{!isFixed && blocksAlwaysAllow && <PolicyNote text="Always allow unavailable" />}
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
				description="Per-tool defaults grouped by integration. Sends and other outbound-delivery calls still ask at runtime when the resolver requires it."
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
