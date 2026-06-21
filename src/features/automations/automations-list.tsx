"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AutomationTemplate, AutomationWithRelations } from "@unison/contracts";
import { ArrowRight, Plus } from "lucide-react";
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
import { Skeleton } from "@/ui/skeleton";
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
// Template card — the whole card is the link (screens.md §5 "Use template").
// ---------------------------------------------------------------------------

function TemplateCard({ template }: { template: AutomationTemplate }) {
	const body = (
		<>
			{/* Header row */}
			<div style={{ alignItems: "flex-start", display: "flex", gap: "8px" }}>
				<p
					style={{
						color: "var(--ink)",
						flex: 1,
						fontSize: "13px",
						fontWeight: 500,
						margin: 0,
					}}
				>
					{template.name}
				</p>
				{template.status === "beta" && <Badge variant="warning">Beta</Badge>}
			</div>

			{/* Description */}
			<p
				style={{
					color: "var(--ink-subtle)",
					display: "-webkit-box",
					flex: 1,
					fontSize: "13px",
					lineHeight: "1.5",
					margin: 0,
					overflow: "hidden",
					WebkitBoxOrient: "vertical",
					WebkitLineClamp: 2,
				}}
			>
				{template.description}
			</p>

			{/* Footer: category + affordance */}
			<div
				style={{
					alignItems: "center",
					display: "flex",
					gap: "6px",
					justifyContent: "space-between",
					marginTop: "4px",
				}}
			>
				<Badge variant="default">{template.category}</Badge>
				{template.available ? (
					<span className="flex items-center gap-1 text-xs text-ink-subtle transition-colors group-hover:text-ink">
						Use template
						<ArrowRight size={12} />
					</span>
				) : (
					<span className="text-xs text-ink-subtle">Coming soon</span>
				)}
			</div>
		</>
	);

	const cardClass =
		"group flex flex-col gap-2 rounded-lg border border-(--border) bg-surface-muted p-4";

	if (!template.available) {
		return (
			<div className={cardClass} style={{ opacity: 0.6 }}>
				{body}
			</div>
		);
	}

	return (
		<Link
			className={`${cardClass} no-underline transition-colors hover:border-[rgba(251,252,252,0.16)] hover:bg-primary-soft`}
			href={`/automations/new?template=${encodeURIComponent(template.key)}`}
		>
			{body}
		</Link>
	);
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function GridSkeleton() {
	return (
		<div
			style={{
				display: "grid",
				gap: "12px",
				gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
			}}
		>
			{[1, 2, 3, 4].map((i) => (
				<Skeleton key={i} style={{ height: "118px", width: "100%" }} />
			))}
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

	const visibleTemplates = (templatesQuery.data ?? []).filter((t) => t.status !== "disabled");
	const automations = automationsQuery.data ?? [];
	// SSR always renders queries as pending — hold skeletons until hydrated.
	const automationsPending = !hydrated || automationsQuery.isLoading;
	const templatesPending = !hydrated || templatesQuery.isLoading;

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
					{automationsPending && <GroupCardSkeleton controlWidth={36} rows={3} />}

					{!automationsPending && automationsQuery.isError && (
						<ErrorState
							message="Failed to load automations."
							onRetry={() => void automationsQuery.refetch()}
						/>
					)}

					{!automationsPending && !automationsQuery.isError && automations.length === 0 && (
						<EmptyState message="No automations yet. Start from a template below, or describe one in chat." />
					)}

					{!automationsPending && !automationsQuery.isError && automations.length > 0 && (
						<GroupCard>
							{automations.map((item) => (
								<AutomationRow key={item.automation.id} item={item} />
							))}
						</GroupCard>
					)}
				</PageSection>

				<PageSection title="Templates">
					{templatesPending && <GridSkeleton />}

					{!templatesPending && templatesQuery.isError && (
						<ErrorState
							message="Failed to load templates."
							onRetry={() => void templatesQuery.refetch()}
						/>
					)}

					{!templatesPending && !templatesQuery.isError && visibleTemplates.length === 0 && (
						<EmptyState message="No templates available yet." />
					)}

					{!templatesPending && !templatesQuery.isError && visibleTemplates.length > 0 && (
						<div
							style={{
								display: "grid",
								gap: "12px",
								gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
							}}
						>
							{visibleTemplates.map((template) => (
								<TemplateCard key={template.key} template={template} />
							))}
						</div>
					)}
				</PageSection>
			</PageFade>
		</PageShell>
	);
}
