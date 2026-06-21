"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mergeAutomationCatalog } from "@unison/client-core";
import type { AutomationTemplate, AutomationWithRelations } from "@unison/contracts";
import { Plus } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { usePrefetchAutomation } from "@/lib/automation-cache";
import { triggerSummary } from "@/lib/automation-format";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
	EmptyState,
	ErrorState,
	GroupCard,
	GroupCardSkeleton,
	PageFade,
	PageSection,
	useHydrated,
} from "@/ui/page-blocks";
import { Toggle } from "@/ui/toggle";

// ---------------------------------------------------------------------------
// Automation row — the whole row links to the detail page (stretched-link
// overlay); the enable switch sits above the overlay so it stays clickable.
// ---------------------------------------------------------------------------

function AutomationRow({ item }: { item: AutomationWithRelations }) {
	const api = useApi();
	const queryClient = useQueryClient();
	const { automation, triggers } = item;
	const isEnabled = automation.status === "enabled";
	const prefetch = usePrefetchAutomation(automation.id);

	const toggleMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			api.updateAutomation(automation.id, { status: enabled ? "enabled" : "disabled" }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automations"] });
			void queryClient.invalidateQueries({ queryKey: ["automation", automation.id] });
		},
	});

	return (
		<div className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-soft">
			<Link
				aria-label={automation.name}
				className="absolute inset-0"
				href={`/automations/${automation.id}`}
				onFocus={prefetch}
				onMouseEnter={prefetch}
				onTouchStart={prefetch}
			/>

			{/* Name + trigger summary */}
			<div style={{ flex: 1, minWidth: 0 }}>
				<p
					style={{
						color: "var(--ink)",
						fontSize: "13px",
						fontWeight: 500,
						margin: 0,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{automation.name}
				</p>
				<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: "2px 0 0" }}>
					{triggerSummary(triggers)}
				</p>
			</div>

			{/* Toggle failure */}
			{toggleMutation.isError && (
				<span
					className="relative"
					style={{ color: "var(--danger)", flexShrink: 0, fontSize: "11px" }}
				>
					Update failed
				</span>
			)}

			{/* Enable switch (above the stretched link) */}
			<div className="relative flex shrink-0 items-center">
				<Toggle
					aria-label={isEnabled ? `Disable ${automation.name}` : `Enable ${automation.name}`}
					checked={isEnabled}
					disabled={toggleMutation.isPending}
					onCheckedChange={(enabled) => toggleMutation.mutate(enabled)}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Default-automation row — a pre-built default the user hasn't enabled yet.
// It isn't a real automation until the toggle flips on, which materializes it
// from the template (POST /v1/automations { kind: "template", enabled: true }).
// ---------------------------------------------------------------------------

function DefaultAutomationRow({ template }: { template: AutomationTemplate }) {
	const api = useApi();
	const queryClient = useQueryClient();

	const enableMutation = useMutation({
		mutationFn: () =>
			api.createAutomation({ enabled: true, kind: "template", templateKey: template.key }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automations"] });
			void queryClient.invalidateQueries({ queryKey: ["automation-templates"] });
		},
	});

	return (
		<div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-soft">
			<div style={{ flex: 1, minWidth: 0 }}>
				<div className="flex items-center gap-2">
					<p
						style={{
							color: "var(--ink)",
							fontSize: "13px",
							fontWeight: 500,
							margin: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{template.name}
					</p>
					<Badge variant="default">Default</Badge>
				</div>
				<p
					style={{
						color: "var(--ink-subtle)",
						fontSize: "12px",
						margin: "2px 0 0",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{template.description}
				</p>
			</div>

			{enableMutation.isError && (
				<span style={{ color: "var(--danger)", flexShrink: 0, fontSize: "11px" }}>
					Couldn&apos;t enable
				</span>
			)}

			<div className="flex shrink-0 items-center">
				<Toggle
					aria-label={`Enable ${template.name}`}
					checked={false}
					disabled={enableMutation.isPending}
					onCheckedChange={() => enableMutation.mutate()}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main list component
// ---------------------------------------------------------------------------

export function AutomationsList() {
	const api = useApi();
	const hydrated = useHydrated();

	const automationsQuery = useQuery({
		queryFn: () => api.listAutomations(),
		queryKey: ["automations"],
		staleTime: 30_000,
	});

	const templatesQuery = useQuery({
		queryFn: () => api.listAutomationTemplates(),
		queryKey: ["automation-templates"],
		staleTime: 300_000,
	});

	const automations = automationsQuery.data ?? [];
	const templates = templatesQuery.data ?? [];
	const catalog = mergeAutomationCatalog(automations, templates);

	// SSR always renders queries as pending — hold skeletons until hydrated.
	const pending = !hydrated || automationsQuery.isLoading || templatesQuery.isLoading;
	const isError = automationsQuery.isError || templatesQuery.isError;

	return (
		<PageShell
			actions={
				<Button asChild size="sm">
					<Link href="/automations/new">
						<Plus size={14} />
						New
					</Link>
				</Button>
			}
			title="Automations"
		>
			<PageFade>
				<PageSection title="Your automations">
					{pending && <GroupCardSkeleton controlWidth={36} rows={4} />}

					{!pending && isError && (
						<ErrorState
							message="Failed to load automations."
							onRetry={() => {
								void automationsQuery.refetch();
								void templatesQuery.refetch();
							}}
						/>
					)}

					{!pending && !isError && catalog.length === 0 && (
						<EmptyState message="No automations yet. Describe one in chat to get started." />
					)}

					{!pending && !isError && catalog.length > 0 && (
						<GroupCard>
							{catalog.map((entry) =>
								entry.kind === "real" ? (
									<AutomationRow item={entry.automation} key={entry.automation.automation.id} />
								) : (
									<DefaultAutomationRow
										key={`template:${entry.template.key}`}
										template={entry.template}
									/>
								),
							)}
						</GroupCard>
					)}
				</PageSection>
			</PageFade>
		</PageShell>
	);
}
