import { FileText, Layers, type LucideIcon, Mail, Mic, ScrollText } from "lucide-react";

import type { ModuleKind } from "./types";

// Single source of truth for a module kind's icon + label — shared by the chip,
// the tabs, the overview, and the canvas header so they never disagree (mirrors
// the old repo's module-icon helper).

export function moduleIcon(kind: ModuleKind): LucideIcon {
	switch (kind) {
		case "email":
			return Mail;
		case "overview":
			return Layers;
		case "report":
			return ScrollText;
		case "transcript":
			return Mic;
		default:
			return FileText;
	}
}

export function moduleKindLabel(kind: ModuleKind): string {
	switch (kind) {
		case "email":
			return "Email";
		case "overview":
			return "Artifacts";
		case "report":
			return "Artifact";
		case "transcript":
			return "Transcript";
		default:
			return "Document";
	}
}
