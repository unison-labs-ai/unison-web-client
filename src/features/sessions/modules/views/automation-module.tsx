"use client";

import { useQuery } from "@tanstack/react-query";
import type { AutomationToolBinding } from "@unison/contracts";
import Link from "next/link";
import type { ReactNode } from "react";

import { useApi } from "@/lib/api-context";
import { permissionAnnotation, triggerSubtitle, triggerSummary } from "@/lib/automation-format";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { AssistantMarkdown } from "../../assistant-markdown";
import type { AutomationModule } from "../types";

// ---------------------------------------------------------------------------
// Automation module view: the in-chat overview of an automation the agent just
// created or edited (plan §D5). Renders from the live automation (fetched by id)
// — name, status/mode, trigger, tools, and the system prompt — with an
// "Open settings" deep link to the full detail page.
// ---------------------------------------------------------------------------

const MODE_LABEL: Record<string, string> = {
	autonomous: "Autonomous",
	human_in_the_loop: "Human in the loop",
	read_only: "Read-only",
};

const STATUS_LABEL: Record<string, string> = {
	archived: "Archived",
	disabled: "Disabled",
	enabled: "Enabled",
};

function toolLabel(binding: AutomationToolBinding): string {
	const segment = binding.toolName.split(".").pop() ?? binding.toolName;
	return binding.displayGroup ? `${binding.displayGroup} · ${segment}` : segment;
}

export function AutomationModuleView({ module }: { module: AutomationModule }) {
	const api = useApi();
	const automationId = module.automationId;
	const query = useQuery({
		enabled: Boolean(automationId),
		queryFn: () => api.getAutomation(automationId as string),
		queryKey: ["automation", automationId],
		staleTime: 5_000,
	});

	if (!automationId || query.isLoading) {
		return (
			<div className="flex flex-col gap-3 px-5 py-4">
				<Skeleton style={{ height: "24px", width: "60%" }} />
				<Skeleton style={{ height: "120px", width: "100%" }} />
			</div>
		);
	}

	if (query.isError || !query.data) {
		return (
			<div className="flex-1 px-5 py-4 text-sm text-danger">Failed to load this automation.</div>
		);
	}

	const { automation, triggers, toolBindings } = query.data;
	const enabledTools = toolBindings.filter((binding) => binding.enabled);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b border-(--line) px-4 py-2.5">
				<span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
					{automation.name}
				</span>
				<Button asChild size="sm" variant="secondary">
					<Link href={`/automations/${automation.id}`}>Open settings</Link>
				</Button>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
				{automation.description ? (
					<p className="text-sm text-ink-muted">{automation.description}</p>
				) : null}

				<Field label="Status">
					{`${STATUS_LABEL[automation.status] ?? automation.status} · ${MODE_LABEL[automation.mode] ?? automation.mode}`}
				</Field>

				<Field label="When">
					<span>{triggerSummary(triggers)}</span>
					{triggers.map((trigger) => {
						const subtitle = triggerSubtitle(trigger);
						return subtitle ? (
							<span className="block text-ink-subtle" key={trigger.id}>
								{subtitle}
							</span>
						) : null;
					})}
				</Field>

				<Field label={`Tools (${enabledTools.length})`}>
					<ul className="flex flex-col gap-0.5">
						{enabledTools.map((binding) => (
							<li className="text-ink-muted" key={binding.id}>
								{toolLabel(binding)}
								{binding.permissionOverride ? (
									<span className="text-ink-subtle">
										{" "}
										— {permissionAnnotation(binding.permissionOverride)}
									</span>
								) : null}
							</li>
						))}
					</ul>
				</Field>

				{automation.systemPrompt ? (
					<Field label="Prompt">
						<div className="rounded-md bg-surface-muted p-3">
							<AssistantMarkdown text={automation.systemPrompt} />
						</div>
					</Field>
				) : null}
			</div>
		</div>
	);
}

function Field({ children, label }: { children: ReactNode; label: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{label}</span>
			<div className="text-sm text-ink">{children}</div>
		</div>
	);
}
