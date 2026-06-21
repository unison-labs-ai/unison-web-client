import type { AutomationTemplate, AutomationWithRelations } from "@unison/contracts";

// A unified automation list = the user's real automations PLUS the pre-built
// default automations they haven't enabled yet. Defaults are virtual catalog
// entries (code templates); enabling one materializes a real automation via
// POST /v1/automations { kind: "template", enabled: true }. Once materialized,
// a template's virtual entry disappears (de-duped by templateKey).

export type AutomationCatalogEntry =
	| { kind: "real"; automation: AutomationWithRelations }
	| { kind: "default"; template: AutomationTemplate };

// Merge real automations with not-yet-materialized default templates.
// Real automations come first (in their given order), then any defaults the
// user hasn't enabled. A default is surfaced only when it is flagged
// `isDefault`, is `available`, isn't `disabled`, and isn't already materialized.
export function mergeAutomationCatalog(
	automations: AutomationWithRelations[],
	templates: AutomationTemplate[],
): AutomationCatalogEntry[] {
	const materializedKeys = new Set(
		automations
			.map((item) => item.automation.templateKey)
			.filter((key): key is string => Boolean(key)),
	);

	const realEntries: AutomationCatalogEntry[] = automations.map((automation) => ({
		automation,
		kind: "real",
	}));

	const defaultEntries: AutomationCatalogEntry[] = templates
		.filter(
			(template) =>
				template.isDefault &&
				template.available &&
				template.status !== "disabled" &&
				!materializedKeys.has(template.key),
		)
		.map((template) => ({ kind: "default", template }));

	return [...realEntries, ...defaultEntries];
}
