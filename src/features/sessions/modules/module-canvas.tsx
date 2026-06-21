"use client";

import { ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { DocumentExportMenuItems } from "@/features/documents/document-actions";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { moduleIcon } from "./module-icon";
import { useModules } from "./modules-context";
import type { Module } from "./types";
import { AutomationModuleView } from "./views/automation-module";
import { DocumentModuleView } from "./views/document-module";
import { EmailModuleView } from "./views/email-module";
import { OverviewModuleView } from "./views/overview-module";
import { ReportModuleView } from "./views/report-module";
import { TranscriptModuleView } from "./views/transcript-module";

// The active module's surface: a header (icon + title + actions) over the
// kind-specific view. The panel only renders when a module is open, so
// `activeModule` is non-null in practice.

export function ModuleCanvas() {
	const { activeModule } = useModules();

	if (!activeModule) {
		return null;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-surface-muted">
			{/* Email/overview/transcript manage their own header; document/report get
			    the shared title + actions row. */}
			{activeModule.kind === "automation" ||
			activeModule.kind === "email" ||
			activeModule.kind === "overview" ||
			activeModule.kind === "transcript" ? null : (
				<ModuleHeader module={activeModule} />
			)}
			<ModuleView module={activeModule} />
		</div>
	);
}

function ModuleView({ module }: { module: Module }) {
	switch (module.kind) {
		case "automation":
			return <AutomationModuleView module={module} />;
		case "document":
			return <DocumentModuleView module={module} />;
		case "email":
			return <EmailModuleView module={module} />;
		case "overview":
			return <OverviewModuleView />;
		case "transcript":
			return <TranscriptModuleView module={module} />;
		default:
			return <ReportModuleView module={module} />;
	}
}

function copyText(module: Module): string {
	switch (module.kind) {
		case "document":
			return module.draftMarkdown;
		case "email":
			return module.email.body;
		case "report":
			return module.markdown;
		default:
			// overview / transcript have no copyable body from the shared header.
			return "";
	}
}

function ModuleHeader({ module }: { module: Module }) {
	const Icon = moduleIcon(module.kind);

	function handleCopy() {
		navigator.clipboard
			.writeText(copyText(module))
			.then(() => toast.success("Copied"))
			.catch(() => toast.error("Couldn't copy"));
	}

	return (
		<div className="flex shrink-0 items-center gap-2 border-b border-(--line) px-4 py-2.5">
			<Icon className="shrink-0 text-ink-muted" size={15} />
			<span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{module.title}</span>

			{module.kind === "document" && module.documentId ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button size="sm" variant="secondary">
							Export
							<ChevronDown size={13} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DocumentExportMenuItems documentId={module.documentId} />
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}

			<Button aria-label="Copy" onClick={handleCopy} size="icon" variant="ghost">
				<Copy size={15} />
			</Button>
		</div>
	);
}
