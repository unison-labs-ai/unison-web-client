"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type {
	AutomationDetailResponse,
	AutomationImportRequest,
	AutomationInvocation,
	AutomationMode,
	AutomationSettingField,
	AutomationSettingsSchema,
	AutomationToolBinding,
	AutomationTrigger,
	AutomationVersion,
	AutomationWithRelations,
} from "@unison/contracts";
import {
	AlertTriangle,
	ArrowRight,
	Check,
	ChevronRight,
	Copy,
	MessageSquare,
	Play,
	Plus,
	SlidersHorizontal,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { automationMentionChip } from "@/features/composer/slash-commands";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "@/features/documents/markdown-bridge";
import { stashComposerSeed } from "@/features/home/composer";
import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { AUTOMATION_STALE_TIME, automationQueryKey } from "@/lib/automation-cache";
import { TRIGGER_ICONS, TRIGGER_TYPE_LABELS, triggerSubtitle } from "@/lib/automation-format";
import { relativeTime } from "@/lib/relative-time";
import { Badge } from "@/ui/badge";
import { Breadcrumb } from "@/ui/breadcrumb";
import { Button } from "@/ui/button";
import {
	CollapsibleCard,
	EmptyState,
	ErrorState,
	GroupCard,
	GroupCardSkeleton,
	GroupRow,
	PageFade,
	PageSection,
} from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";
import { TabNav } from "@/ui/tab-nav";
import { Toggle } from "@/ui/toggle";

import { buildToolsets, enabledToolTitles } from "./automation-toolsets";
import { ToolsModal, TriggersModal } from "./manage-modals";

// ---------------------------------------------------------------------------
// Helpers / constants
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<string, string> = {
	autonomous: "Autonomous",
	human_in_the_loop: "Human in the loop",
	read_only: "Read only",
};

const MODE_OPTIONS: { description: string; label: string; value: AutomationMode }[] = [
	{
		description:
			"Runs allowed non-send actions automatically, including destructive external changes.",
		label: "Autonomous",
		value: "autonomous",
	},
	{
		description: "Reads, internal work, and known-safe saves run; other external changes ask.",
		label: "Human in the loop",
		value: "human_in_the_loop",
	},
	{
		description: "External reads and internal work run; external writes are unavailable.",
		label: "Read only",
		value: "read_only",
	},
];

// Run status stays neutral ink — only problems get color (failed, approval).
function invocationStatusColor(inv: AutomationInvocation): string {
	const status = inv.runSummary?.status ?? inv.status;
	if (status === "failed") return "var(--danger)";
	if (status === "approval_needed") return "var(--warning)";
	return "var(--ink-subtle)";
}

function invocationLabel(inv: AutomationInvocation): string {
	return (inv.runSummary?.status ?? inv.status).replaceAll("_", " ");
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
	if (!startedAt || !finishedAt) return "—";
	const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * An automation export envelope (automationExportSchema) carries `version` and
 * `exportedAt` at its top level — its `automation` key holds bare fields, NOT
 * another envelope. Used to decide whether an imported file needs unwrapping.
 */
function looksLikeExportEnvelope(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && "version" in value && "exportedAt" in value;
}

// Shared styles for form controls. 32px tall so inputs, selects and default
// buttons all sit on the same line height (Town keeps these flush).
const FORM_CONTROL_STYLE: React.CSSProperties = {
	background: "var(--surface)",
	border: "1px solid var(--border)",
	borderRadius: "var(--radius-md)",
	color: "var(--ink)",
	fontFamily: "inherit",
	fontSize: "13px",
	height: "32px",
	padding: "0 10px",
	width: "100%",
};

// Multiline controls share the chrome but size by rows, with inner padding.
const TEXTAREA_STYLE: React.CSSProperties = {
	...FORM_CONTROL_STYLE,
	height: "auto",
	lineHeight: "1.6",
	padding: "8px 10px",
	resize: "vertical",
};

// Right-aligned control inside a GroupRow (selects, short text/number inputs).
const ROW_CONTROL_STYLE: React.CSSProperties = {
	...FORM_CONTROL_STYLE,
	maxWidth: "220px",
	width: "220px",
};

function InlineError({ children }: { children: React.ReactNode }) {
	return (
		<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0, padding: "10px 16px" }}>
			{children}
		</p>
	);
}

// ---------------------------------------------------------------------------
// Tab IDs
// ---------------------------------------------------------------------------

type TabId = "sessions" | "settings" | "info";
const TABS: { id: TabId; label: string }[] = [
	{ id: "sessions", label: "Sessions" },
	{ id: "settings", label: "Settings" },
	{ id: "info", label: "Info" },
];

// Pre-rework URLs used overview/runs/configuration/versions — keep them working.
const LEGACY_TAB_ALIASES: Record<string, TabId> = {
	configuration: "settings",
	overview: "sessions",
	runs: "sessions",
	versions: "info",
};

function normalizeTab(raw: string | null): TabId {
	if (raw && TABS.some((tab) => tab.id === raw)) return raw as TabId;
	return (raw && LEGACY_TAB_ALIASES[raw]) || "sessions";
}

// ---------------------------------------------------------------------------
// Full-width field block inside a card (textareas, chip lists).
// ---------------------------------------------------------------------------

function FieldBlock({
	children,
	description,
	htmlFor,
	label,
	required,
}: {
	children: React.ReactNode;
	description?: string;
	htmlFor?: string;
	label: string;
	required?: boolean;
}) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 16px" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
				<label htmlFor={htmlFor} style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500 }}>
					{label}
					{required && <span style={{ color: "var(--danger)" }}> *</span>}
				</label>
				{description ? (
					<span style={{ color: "var(--ink-muted)", fontSize: "12px", lineHeight: "16px" }}>
						{description}
					</span>
				) : null}
			</div>
			{children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Chip-list editor — list values render as removable chips with an inline
// "add item" input (mirrors Town's routine preferences pattern: the Add
// button is exactly as tall as the input beside it).
// ---------------------------------------------------------------------------

function splitListInput(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function ChipListEditor({
	disabled,
	onChange,
	placeholder,
	value,
}: {
	disabled?: boolean;
	onChange: (next: string) => void;
	placeholder?: string;
	value: string;
}) {
	const [draft, setDraft] = useState("");
	const items = splitListInput(value);

	function addDraft() {
		const next = draft.trim();
		if (!next) return;
		// The lists are sets semantically (skip domains, sections) — drop dupes,
		// which also keeps `item` valid as the React key below.
		if (!items.includes(next)) {
			onChange([...items, next].join(", "));
		}
		setDraft("");
	}

	function remove(item: string) {
		onChange(items.filter((existing) => existing !== item).join(", "));
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
			{items.length > 0 && (
				<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
					{items.map((item) => (
						<span
							className="flex items-center gap-1.5 rounded-pill border border-(--border) bg-surface px-2.5 py-1 text-xs text-ink"
							key={item}
						>
							{item}
							<button
								aria-label={`Remove ${item}`}
								className="flex items-center rounded-full border-none bg-transparent p-0.5 text-ink-subtle hover:text-danger"
								disabled={disabled}
								onClick={() => remove(item)}
								type="button"
							>
								<X size={11} />
							</button>
						</span>
					))}
				</div>
			)}
			<div style={{ display: "flex", gap: "8px" }}>
				<input
					disabled={disabled}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							addDraft();
						}
					}}
					className="form-control"
					placeholder={placeholder ?? "Add item…"}
					style={{ ...FORM_CONTROL_STYLE, flex: 1, width: "auto" }}
					type="text"
					value={draft}
				/>
				<Button
					disabled={disabled || draft.trim().length === 0}
					onClick={addDraft}
					type="button"
					variant="secondary"
				>
					Add
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sessions tab — what the automation actually did, newest first (Town's
// "Recent sessions"). Row: time · trigger · duration · status.
// ---------------------------------------------------------------------------

function SessionsTab({ automationId }: { automationId: string }) {
	const api = useApi();

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listAutomationInvocations(automationId),
		queryKey: ["automation-invocations", automationId],
		staleTime: 30_000,
	});

	if (isLoading) {
		return <GroupCardSkeleton controlWidth={64} rows={4} />;
	}

	if (isError) {
		return <ErrorState message="Failed to load sessions." onRetry={() => void refetch()} />;
	}

	const invocations = data ?? [];

	if (invocations.length === 0) {
		return <EmptyState message="No sessions yet — Run now starts one." />;
	}

	return (
		<GroupCard>
			{invocations.map((inv) => (
				<Link
					className="grid items-center gap-3 px-4 py-3 text-inherit no-underline transition-colors hover:bg-primary-soft"
					href={`/automations/${automationId}/runs/${inv.id}`}
					key={inv.id}
					style={{ gridTemplateColumns: "64px 1fr auto auto" }}
				>
					{/* Time */}
					<span style={{ color: "var(--ink-subtle)", fontSize: "12px" }}>
						{inv.createdAt ? relativeTime(inv.createdAt) : "—"}
					</span>

					{/* Trigger type + error summary */}
					<div style={{ minWidth: 0 }}>
						<p
							style={{
								color: "var(--ink)",
								fontSize: "13px",
								margin: 0,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{TRIGGER_TYPE_LABELS[inv.triggerType ?? "manual"] ?? inv.triggerType ?? "Manual"}
						</p>
						{inv.errorSummary && (
							<p
								style={{
									color: "var(--danger)",
									fontSize: "11px",
									margin: "2px 0 0",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{inv.errorSummary}
							</p>
						)}
					</div>

					{/* Duration */}
					<span style={{ color: "var(--ink-subtle)", flexShrink: 0, fontSize: "12px" }}>
						{formatDuration(inv.startedAt, inv.finishedAt)}
					</span>

					{/* Status */}
					<span
						style={{
							color: invocationStatusColor(inv),
							fontSize: "11px",
							fontWeight: 500,
							textAlign: "right",
							textTransform: "uppercase",
						}}
					>
						{invocationLabel(inv)}
					</span>
				</Link>
			))}
		</GroupCard>
	);
}

// ---------------------------------------------------------------------------
// Settings — integration health banner (Town's amber "Not connected — X · Fix").
// ---------------------------------------------------------------------------

function IntegrationBanner({
	integrationHealth,
}: {
	integrationHealth: AutomationDetailResponse["integrationHealth"];
}) {
	const unhealthy = integrationHealth.filter((h) => !h.healthy);
	if (unhealthy.length === 0) return null;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
			{unhealthy.map((h) => (
				<div
					// Multiple requirements can share a provider (e.g. two Google
					// integrations) — the label is the unique display identity.
					key={`${h.provider}-${h.label}`}
					style={{
						alignItems: "center",
						background: "var(--warning-soft)",
						border: "1px solid var(--warning)",
						borderRadius: "var(--radius)",
						display: "flex",
						gap: "10px",
						padding: "10px 14px",
					}}
				>
					<AlertTriangle size={13} style={{ color: "var(--warning)", flexShrink: 0 }} />
					<span style={{ color: "var(--ink)", fontSize: "13px", minWidth: 0 }}>
						Not connected — {h.label}
					</span>
					<span style={{ flex: 1 }} />
					<Link
						className="flex shrink-0 items-center gap-1 no-underline hover:underline"
						href={`/connections/${h.provider}`}
						style={{ color: "var(--warning)", fontSize: "12px", fontWeight: 500 }}
					>
						Fix
						<ArrowRight size={12} />
					</Link>
				</div>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Settings — preferences (the automation's settingsSchema fields).
// ---------------------------------------------------------------------------

type SettingsFieldKind = "boolean" | "json" | "list" | "number" | "select" | "text" | "textarea";

function settingsFieldKind(field: AutomationSettingField): SettingsFieldKind {
	switch (field.type) {
		case "boolean":
			return "boolean";
		case "number":
			return "number";
		case "select":
			return field.options && field.options.length > 0 ? "select" : "text";
		case "multi_select":
		case "chip_list":
		case "string_list":
			return "list";
		case "day_of_week":
		case "account_picker":
		case "integration_picker":
		case "toolset_picker":
			// Picker fields take a single string unless config.multiple is set.
			return field.config.multiple === true ? "list" : "text";
		case "json":
		case "repeated_object":
		case "relative_duration":
		case "output_destination":
			return "json";
		case "textarea":
			return "textarea";
		default:
			// text, string, time, timezone, url, color.
			return "text";
	}
}

function initialSettingInput(
	field: AutomationSettingField,
	values: Record<string, unknown>,
): string | boolean {
	const value = Object.hasOwn(values, field.key) ? values[field.key] : field.default;
	const kind = settingsFieldKind(field);
	if (kind === "boolean") {
		return value === true;
	}
	if (value === undefined || value === null) {
		return "";
	}
	if (kind === "list") {
		return Array.isArray(value) ? value.map((item) => String(item)).join(", ") : String(value);
	}
	if (kind === "json") {
		return JSON.stringify(value, null, 2);
	}
	return typeof value === "string" ? value : String(value);
}

function PreferencesCard({
	automationId,
	schema,
	values,
}: {
	automationId: string;
	schema: AutomationSettingsSchema;
	values: Record<string, unknown>;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const fields = schema.fields;

	const initialInputs = () => {
		const initial: Record<string, string | boolean> = {};
		for (const field of fields) {
			initial[field.key] = initialSettingInput(field, values);
		}
		return initial;
	};
	const [inputs, setInputs] = useState<Record<string, string | boolean>>(initialInputs);
	const [baseline, setBaseline] = useState<Record<string, string | boolean>>(inputs);
	const [validationError, setValidationError] = useState<string | null>(null);

	const dirty = useMemo(
		() => fields.some((field) => inputs[field.key] !== baseline[field.key]),
		[fields, inputs, baseline],
	);

	const saveMutation = useMutation({
		mutationFn: (settingsValues: Record<string, unknown>) =>
			api.updateAutomationSettings(automationId, { settingsValues }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
		},
	});

	function setInput(key: string, value: string | boolean) {
		setInputs((previous) => ({ ...previous, [key]: value }));
	}

	function handleSave() {
		setValidationError(null);
		// Start from the stored record so keys without a schema field survive the
		// full-replace PATCH; cleared inputs drop their key (field default applies).
		const payload: Record<string, unknown> = { ...values };
		for (const field of fields) {
			const kind = settingsFieldKind(field);
			const raw = inputs[field.key];
			if (kind === "boolean") {
				payload[field.key] = raw === true;
				continue;
			}
			const text = typeof raw === "string" ? raw.trim() : "";
			if (text.length === 0) {
				delete payload[field.key];
				continue;
			}
			if (kind === "number") {
				const numberValue = Number(text);
				if (!Number.isFinite(numberValue)) {
					setValidationError(`${field.label} must be a number.`);
					return;
				}
				payload[field.key] = numberValue;
				continue;
			}
			if (kind === "list") {
				payload[field.key] = splitListInput(text);
				continue;
			}
			if (kind === "json") {
				try {
					payload[field.key] = JSON.parse(text) as unknown;
				} catch {
					setValidationError(`${field.label} must be valid JSON.`);
					return;
				}
				continue;
			}
			payload[field.key] = kind === "textarea" && typeof raw === "string" ? raw : text;
		}
		const snapshot = { ...inputs };
		saveMutation.mutate(payload, { onSuccess: () => setBaseline(snapshot) });
	}

	if (fields.length === 0) {
		return null;
	}

	return (
		<CollapsibleCard
			description="What this automation pays attention to and how it delivers."
			title="Preferences"
		>
			{fields.map((field) => {
				const kind = settingsFieldKind(field);
				const inputId = `automation-setting-${field.key}`;
				const raw = inputs[field.key];
				const textValue = typeof raw === "string" ? raw : "";

				if (kind === "boolean") {
					return (
						<GroupRow description={field.description} key={field.key} title={field.label}>
							<Toggle
								aria-label={field.label}
								checked={raw === true}
								onCheckedChange={(checked) => setInput(field.key, checked)}
							/>
						</GroupRow>
					);
				}

				if (kind === "select") {
					return (
						<GroupRow description={field.description} key={field.key} title={field.label}>
							<select
								className="form-control"
								id={inputId}
								onChange={(e) => setInput(field.key, e.target.value)}
								style={ROW_CONTROL_STYLE}
								value={textValue}
							>
								<option value="">Default</option>
								{(field.options ?? []).map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</GroupRow>
					);
				}

				if (kind === "text" || kind === "number") {
					return (
						<GroupRow description={field.description} key={field.key} title={field.label}>
							<input
								className="form-control"
								id={inputId}
								max={kind === "number" ? field.max : undefined}
								min={kind === "number" ? field.min : undefined}
								onChange={(e) => setInput(field.key, e.target.value)}
								placeholder={field.placeholder}
								step={kind === "number" ? field.step : undefined}
								style={ROW_CONTROL_STYLE}
								type={kind === "number" ? "number" : "text"}
								value={textValue}
							/>
						</GroupRow>
					);
				}

				if (kind === "list") {
					return (
						<FieldBlock
							description={field.description}
							key={field.key}
							label={field.label}
							required={field.required}
						>
							<ChipListEditor
								onChange={(next) => setInput(field.key, next)}
								placeholder={field.placeholder}
								value={textValue}
							/>
						</FieldBlock>
					);
				}

				// textarea / json
				return (
					<FieldBlock
						description={field.description}
						htmlFor={inputId}
						key={field.key}
						label={field.label}
						required={field.required}
					>
						<textarea
							className={kind === "json" ? "form-control font-mono" : "form-control"}
							id={inputId}
							onChange={(e) => setInput(field.key, e.target.value)}
							placeholder={field.placeholder}
							rows={kind === "json" ? 4 : 3}
							style={TEXTAREA_STYLE}
							value={textValue}
						/>
					</FieldBlock>
				);
			})}

			{validationError && <InlineError>{validationError}</InlineError>}
			{saveMutation.isError && (
				<InlineError>
					{saveMutation.error instanceof Error
						? saveMutation.error.message
						: "Failed to save settings."}
				</InlineError>
			)}
			<div style={{ padding: "12px 16px" }}>
				<Button disabled={!dirty || saveMutation.isPending} onClick={handleSave}>
					{saveMutation.isPending ? "Saving…" : "Save preferences"}
				</Button>
			</div>
		</CollapsibleCard>
	);
}

// ---------------------------------------------------------------------------
// Settings — triggers. The card is a read view (Town-style rows); clicking a
// row or "Add trigger" opens the two-pane manage modal.
// ---------------------------------------------------------------------------

function TriggersCard({
	automationId,
	triggers,
}: {
	automationId: string;
	triggers: AutomationTrigger[];
}) {
	const [modalOpen, setModalOpen] = useState(false);
	const [modalSelection, setModalSelection] = useState<string | null>(null);

	function openModal(triggerId: string | null) {
		setModalSelection(triggerId);
		setModalOpen(true);
	}

	// Removing a trigger soft-disables it server-side (the DELETE route keeps
	// the row for version history) — disabled triggers read as removed here.
	const activeTriggers = triggers.filter((trigger) => trigger.enabled);

	return (
		<CollapsibleCard description="When this automation runs." title="Triggers">
			{activeTriggers.map((trigger) => {
				const Icon = TRIGGER_ICONS[trigger.triggerType] ?? SlidersHorizontal;
				const subtitle = triggerSubtitle(trigger);
				return (
					<button
						className="flex w-full items-center gap-3 border-none bg-transparent text-left outline-none transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ring)"
						key={trigger.id}
						onClick={() => openModal(trigger.id)}
						style={{ padding: "11px 16px" }}
						type="button"
					>
						<Icon size={15} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
						<div style={{ flex: 1, minWidth: 0 }}>
							<p style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500, margin: 0 }}>
								{trigger.displayName ??
									TRIGGER_TYPE_LABELS[trigger.triggerType] ??
									trigger.triggerType}
							</p>
							{subtitle && (
								<p style={{ color: "var(--ink-muted)", fontSize: "12px", margin: "2px 0 0" }}>
									{subtitle}
								</p>
							)}
						</div>
						{trigger.nextRunAt && (
							<span style={{ color: "var(--ink-subtle)", flexShrink: 0, fontSize: "11px" }}>
								Next · {new Date(trigger.nextRunAt).toLocaleString()}
							</span>
						)}
						<ChevronRight size={14} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
					</button>
				);
			})}

			<div style={{ padding: "12px 16px" }}>
				<Button onClick={() => openModal(null)} variant="secondary">
					<Plus size={13} />
					Add trigger
				</Button>
			</div>

			<TriggersModal
				automationId={automationId}
				initialSelection={modalSelection}
				onOpenChange={setModalOpen}
				open={modalOpen}
				triggers={activeTriggers}
			/>
		</CollapsibleCard>
	);
}

// ---------------------------------------------------------------------------
// Settings — tools and permissions. Execution mode, then a read view of the
// toolsets in use (icon + enabled tools); clicking a row or "Add or edit
// tools" opens the two-pane manage modal.
// ---------------------------------------------------------------------------

function ToolsCard({
	automationId,
	mode,
	toolBindings,
}: {
	automationId: string;
	mode: AutomationMode;
	toolBindings: AutomationToolBinding[];
}) {
	const api = useApi();
	const queryClient = useQueryClient();

	const catalogQuery = useQuery({
		queryFn: () => api.listTools(),
		queryKey: ["tool-catalog"],
		staleTime: 30_000,
	});

	const [modeValue, setModeValue] = useState<AutomationMode>(mode);
	const modeMutation = useMutation({
		mutationFn: (next: AutomationMode) => api.updateAutomation(automationId, { mode: next }),
		onError: () => setModeValue(mode),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
		},
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [modalToolsetId, setModalToolsetId] = useState<string | null>(null);

	function openModal(toolsetId: string | null) {
		setModalToolsetId(toolsetId);
		setModalOpen(true);
	}

	const toolsets = useMemo(
		() => buildToolsets(catalogQuery.data?.tools ?? [], toolBindings),
		[catalogQuery.data, toolBindings],
	);
	const activeToolsets = toolsets.filter((set) => set.enabledCount > 0);
	const selectedModeOption = MODE_OPTIONS.find((option) => option.value === modeValue);

	return (
		<CollapsibleCard
			description="Which tools this automation can use, and the approval level for each."
			title="Tools"
		>
			<GroupRow description="The default tool behavior for this automation." title="Execution mode">
				<select
					aria-label="Execution mode"
					className="form-control"
					disabled={modeMutation.isPending}
					onChange={(e) => {
						const next = e.target.value as AutomationMode;
						setModeValue(next);
						modeMutation.mutate(next);
					}}
					style={ROW_CONTROL_STYLE}
					value={modeValue}
				>
					{MODE_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				{selectedModeOption ? (
					<p className="type-small" style={{ color: "var(--ink-muted)", margin: "6px 0 0" }}>
						{selectedModeOption.description}
					</p>
				) : null}
			</GroupRow>
			{modeMutation.isError && <InlineError>Failed to update execution mode.</InlineError>}

			{catalogQuery.isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 16px" }}>
					{[1, 2].map((row) => (
						<Skeleton key={row} style={{ height: "32px", width: "100%" }} />
					))}
				</div>
			)}

			{catalogQuery.isError && (
				<ErrorState
					message="Failed to load the tool catalog."
					onRetry={() => void catalogQuery.refetch()}
				/>
			)}

			{!catalogQuery.isLoading && !catalogQuery.isError && (
				<>
					{activeToolsets.length === 0 && (
						<p
							style={{
								color: "var(--ink-subtle)",
								fontSize: "13px",
								margin: 0,
								padding: "12px 16px",
							}}
						>
							No tools enabled yet.
						</p>
					)}
					{activeToolsets.map((set) => {
						const titles = enabledToolTitles(set, toolBindings);
						return (
							<button
								className="flex w-full items-center gap-3 border-none bg-transparent text-left outline-none transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ring)"
								key={set.id}
								onClick={() => openModal(set.id)}
								style={{ padding: "11px 16px" }}
								type="button"
							>
								<set.icon size={15} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<p style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500, margin: 0 }}>
										{set.label}
									</p>
									<p
										style={{
											color: "var(--ink-muted)",
											fontSize: "12px",
											margin: "2px 0 0",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{titles.join(", ")}
									</p>
								</div>
								<ChevronRight size={14} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
							</button>
						);
					})}

					<div style={{ padding: "12px 16px" }}>
						<Button onClick={() => openModal(null)} variant="secondary">
							<Plus size={13} />
							Add or edit tools
						</Button>
					</div>
				</>
			)}

			<ToolsModal
				automationId={automationId}
				initialToolsetId={modalToolsetId}
				onOpenChange={setModalOpen}
				open={modalOpen}
				toolBindings={toolBindings}
			/>
		</CollapsibleCard>
	);
}

// ---------------------------------------------------------------------------
// Settings — the system prompt: one inline markdown editor plus Save. The
// editor IS the rendered view (TipTap over the same markdown bridge documents
// use), so non-technical users never see raw markdown, compile wrappers, or a
// separate preview.
// ---------------------------------------------------------------------------

function SystemPromptCard({
	automationId,
	systemPrompt,
}: {
	automationId: string;
	systemPrompt: string | null;
}) {
	const api = useApi();
	const queryClient = useQueryClient();

	const [dirty, setDirty] = useState(false);
	// Baseline = the round-tripped serialization, so the bridge's markdown
	// normalization alone never counts as an edit (same rule as documents).
	const baselineRef = useRef("");

	const editor = useEditor({
		content: markdownToEditorHtml(systemPrompt ?? ""),
		editorProps: { attributes: { "aria-label": "System prompt" } },
		extensions: [StarterKit],
		immediatelyRender: false,
		onCreate: ({ editor: created }) => {
			baselineRef.current = editorHtmlToMarkdown(created.getHTML());
		},
		onUpdate: ({ editor: updated }) => {
			setDirty(editorHtmlToMarkdown(updated.getHTML()) !== baselineRef.current);
		},
	});

	const saveMutation = useMutation({
		mutationFn: () => {
			const markdown = editor ? editorHtmlToMarkdown(editor.getHTML()) : "";
			return api.updateAutomation(automationId, { systemPrompt: markdown || null });
		},
		onSuccess: () => {
			baselineRef.current = editor ? editorHtmlToMarkdown(editor.getHTML()) : "";
			setDirty(false);
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
		},
	});

	return (
		<CollapsibleCard
			description="What this automation is told to do on every run. Plain language is fine."
			title="System prompt"
		>
			<div style={{ padding: "12px 16px" }}>
				<div
					className="doc-editor prompt-editor"
					style={{
						background: "var(--background)",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius-md)",
					}}
				>
					<EditorContent editor={editor} />
				</div>
			</div>

			{saveMutation.isError && (
				<InlineError>Failed to save the system prompt. Try again.</InlineError>
			)}

			<div style={{ padding: "0 16px 12px" }}>
				<Button disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
					{saveMutation.isPending ? "Saving…" : "Save"}
				</Button>
			</div>
		</CollapsibleCard>
	);
}

// ---------------------------------------------------------------------------
// Settings — webhook (loads on mount; 404 simply means "none").
// ---------------------------------------------------------------------------

function WebhookCard({ automationId }: { automationId: string }) {
	const api = useApi();
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState(false);

	const webhookQuery = useQuery({
		queryFn: () => api.getAutomationWebhook(automationId),
		queryKey: ["automation-webhook", automationId],
		retry: (failureCount, error) => {
			if (error instanceof WebApiError && error.status === 404) return false;
			return failureCount < 2;
		},
		staleTime: 30_000,
	});

	const missing =
		webhookQuery.isError &&
		webhookQuery.error instanceof WebApiError &&
		webhookQuery.error.status === 404;

	function handleCopy(url: string) {
		setCopyError(false);
		navigator.clipboard
			.writeText(url)
			.then(() => {
				setCopied(true);
				window.setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => {
				setCopyError(true);
			});
	}

	return (
		<CollapsibleCard description="Trigger this automation from outside Unison." title="Webhook">
			{webhookQuery.isLoading && (
				<div style={{ padding: "12px 16px" }}>
					<Skeleton style={{ height: "32px", width: "100%" }} />
				</div>
			)}

			{missing && (
				<p
					style={{ color: "var(--ink-subtle)", fontSize: "13px", margin: 0, padding: "12px 16px" }}
				>
					No webhook configured.
				</p>
			)}

			{webhookQuery.isError && !missing && (
				<ErrorState message="Failed to load webhook." onRetry={() => void webhookQuery.refetch()} />
			)}

			{webhookQuery.data &&
				(() => {
					const { enabled, urlPath } = webhookQuery.data.webhook;
					const fullUrl = `${api.apiBaseUrl}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;
					return (
						<div
							style={{
								alignItems: "center",
								display: "flex",
								gap: "10px",
								padding: "10px 16px",
							}}
						>
							<code
								className="font-mono"
								style={{
									color: "var(--ink)",
									flex: 1,
									fontSize: "12px",
									minWidth: 0,
									overflowWrap: "anywhere",
								}}
							>
								{fullUrl}
							</code>
							{!enabled && <Badge variant="default">Off</Badge>}
							<Button
								aria-label="Copy webhook URL"
								onClick={() => handleCopy(fullUrl)}
								size="sm"
								variant="secondary"
							>
								{copied ? <Check size={13} /> : <Copy size={13} />}
								{copied ? "Copied" : "Copy"}
							</Button>
						</div>
					);
				})()}

			{copyError && <InlineError>Couldn&rsquo;t copy the URL — copy it manually.</InlineError>}
		</CollapsibleCard>
	);
}

// ---------------------------------------------------------------------------
// Settings — advanced (account scope, import/export). Collapsed by default;
// these are the rarely-touched knobs.
// ---------------------------------------------------------------------------

function AdvancedCard({
	accountScope,
	automationId,
}: {
	accountScope: Record<string, unknown>;
	automationId: string;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [importing, setImporting] = useState(false);
	const importInputRef = useRef<HTMLInputElement>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const scopeEntries = Object.entries(accountScope ?? {});

	async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		setActionError(null);
		setImporting(true);
		try {
			const parsed: unknown = JSON.parse(await file.text());
			// The export download IS the envelope (version/exportedAt at top level) —
			// pass it through unchanged. Only unwrap `{ automation: <envelope> }`
			// wrappers (a saved export response / import request); the envelope's own
			// `automation` key holds bare fields, so the old "automation" in parsed
			// heuristic would strip the envelope and fail the import schema.
			const wrapped =
				parsed && typeof parsed === "object" && "automation" in parsed
					? (parsed as { automation: unknown }).automation
					: undefined;
			const payload = looksLikeExportEnvelope(wrapped) ? wrapped : parsed;
			const result = await api.importAutomation({
				automation: payload as AutomationImportRequest["automation"],
			});
			await queryClient.invalidateQueries({ queryKey: ["automations"] });
			router.push(`/automations/${result.automation.id}`);
		} catch {
			setActionError("Import failed — the file is not a valid automation export.");
		} finally {
			setImporting(false);
		}
	}

	async function handleExport() {
		setActionError(null);
		try {
			const result = await api.exportAutomation(automationId);
			const blob = new Blob([JSON.stringify(result.automation, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `automation-${automationId}.json`;
			a.click();
			// Revoking synchronously after click() races the download start in
			// Firefox/Safari — defer so the browser can open the blob first.
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch {
			setActionError("Export failed.");
		}
	}

	return (
		<CollapsibleCard defaultOpen={false} title="Advanced">
			{scopeEntries.length === 0 ? (
				<GroupRow
					description="Which connected accounts this automation may act through."
					title="Account scope"
				>
					<span style={{ color: "var(--ink-muted)", fontSize: "13px" }}>
						All connected accounts
					</span>
				</GroupRow>
			) : (
				scopeEntries.map(([key, value]) => (
					<GroupRow key={key} title={key}>
						<span style={{ color: "var(--ink-muted)", fontSize: "13px" }}>
							{typeof value === "string" ? value : JSON.stringify(value)}
						</span>
					</GroupRow>
				))
			)}

			<GroupRow
				description="Move this automation between workspaces as JSON."
				title="Import & export"
			>
				<div style={{ display: "flex", gap: "8px" }}>
					<Button onClick={() => void handleExport()} size="sm" variant="secondary">
						Export
					</Button>
					<Button
						disabled={importing}
						onClick={() => importInputRef.current?.click()}
						size="sm"
						variant="secondary"
					>
						{importing ? "Importing…" : "Import"}
					</Button>
					<input
						accept="application/json,.json"
						onChange={(e) => void handleImportFile(e)}
						ref={importInputRef}
						style={{ display: "none" }}
						type="file"
					/>
				</div>
			</GroupRow>

			{actionError && <InlineError>{actionError}</InlineError>}
		</CollapsibleCard>
	);
}

// ---------------------------------------------------------------------------
// Settings tab — Town-style stack of accordion cards.
// ---------------------------------------------------------------------------

function SettingsTab({
	automationId,
	data,
}: {
	automationId: string;
	data: AutomationDetailResponse;
}) {
	return (
		<>
			<IntegrationBanner integrationHealth={data.integrationHealth} />
			<PreferencesCard
				automationId={automationId}
				schema={data.automation.settingsSchema}
				values={data.automation.settingsValues}
			/>
			<TriggersCard automationId={automationId} triggers={data.triggers} />
			<ToolsCard
				automationId={automationId}
				mode={data.automation.mode}
				toolBindings={data.toolBindings}
			/>
			<SystemPromptCard automationId={automationId} systemPrompt={data.automation.systemPrompt} />
			<WebhookCard automationId={automationId} />
			<AdvancedCard accountScope={data.automation.accountScope} automationId={automationId} />
		</>
	);
}

// ---------------------------------------------------------------------------
// Info tab — facts, memories, versions (Town's Info, plus our version history).
// ---------------------------------------------------------------------------

function InfoTab({ automationId, data }: { automationId: string; data: AutomationDetailResponse }) {
	const api = useApi();
	const queryClient = useQueryClient();
	const { automation, memories, runStats, versions } = data;

	const restoreMutation = useMutation({
		mutationFn: (versionId: string) => api.restoreAutomationVersion(automationId, versionId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
		},
	});

	const factValue: React.CSSProperties = { color: "var(--ink-muted)", fontSize: "13px" };

	return (
		<>
			<PageSection title="Information">
				<GroupCard>
					<GroupRow title="Execution mode">
						<span style={factValue}>{MODE_LABELS[automation.mode] ?? automation.mode}</span>
					</GroupRow>
					{automation.templateKey ? (
						<GroupRow description="The template this automation was created from." title="Template">
							<span className="font-mono" style={{ color: "var(--ink-muted)", fontSize: "12px" }}>
								{automation.templateKey}
							</span>
						</GroupRow>
					) : null}
					<GroupRow description="Bumped on every configuration change." title="Version">
						<span style={factValue}>v{automation.version}</span>
					</GroupRow>
					<GroupRow title="Created">
						<span style={factValue}>
							{new Date(automation.createdAt).toLocaleDateString(undefined, {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</span>
					</GroupRow>
					<GroupRow title="Last run">
						<span style={{ ...factValue, textTransform: "capitalize" }}>
							{runStats.lastRunAt
								? `${relativeTime(runStats.lastRunAt)}${
										runStats.lastStatus ? ` · ${runStats.lastStatus.replaceAll("_", " ")}` : ""
									}`
								: "Never"}
						</span>
					</GroupRow>
					<GroupRow title="Activity">
						<span style={factValue}>
							{runStats.runCount24h} past day · {runStats.runCount7d} past week
						</span>
					</GroupRow>
				</GroupCard>
			</PageSection>

			<PageSection
				description="Saved automatically as this automation runs; injected into every run."
				title={`Memories (${memories.length})`}
			>
				{memories.length === 0 ? (
					<p style={{ color: "var(--ink-subtle)", fontSize: "13px", margin: 0 }}>
						No memories yet.
					</p>
				) : (
					<GroupCard>
						{memories.map((memory) => (
							<p
								key={memory.id}
								style={{
									color: "var(--ink-muted)",
									fontSize: "13px",
									lineHeight: "1.5",
									margin: 0,
									padding: "12px 16px",
								}}
							>
								{memory.content}
							</p>
						))}
					</GroupCard>
				)}
			</PageSection>

			<PageSection description="Restore any earlier configuration." title="Versions">
				{versions.length === 0 ? (
					<p style={{ color: "var(--ink-subtle)", fontSize: "13px", margin: 0 }}>
						No versions yet.
					</p>
				) : (
					<>
						{restoreMutation.isError && (
							<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>
								Failed to restore version. Try again.
							</p>
						)}
						<GroupCard>
							{versions.map((version: AutomationVersion) => (
								<div
									key={version.id}
									style={{
										alignItems: "center",
										display: "flex",
										gap: "12px",
										padding: "10px 16px",
									}}
								>
									<span
										style={{
											background: "var(--surface)",
											border: "1px solid var(--border)",
											borderRadius: "var(--radius-sm)",
											color: "var(--ink-muted)",
											flexShrink: 0,
											fontSize: "11px",
											fontWeight: 500,
											padding: "2px 6px",
										}}
									>
										v{version.version}
									</span>

									<p
										style={{
											color: "var(--ink-subtle)",
											flex: 1,
											fontSize: "13px",
											margin: 0,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{version.changeSummary ?? "No summary"}
									</p>

									<span style={{ color: "var(--ink-subtle)", flexShrink: 0, fontSize: "12px" }}>
										{new Date(version.createdAt).toLocaleDateString()}
									</span>

									<Button
										disabled={restoreMutation.isPending}
										onClick={() => restoreMutation.mutate(version.id)}
										size="sm"
										variant="secondary"
									>
										Restore
									</Button>
								</div>
							))}
						</GroupCard>
					</>
				)}
			</PageSection>
		</>
	);
}

// ---------------------------------------------------------------------------
// Title block — name, description, actions (Run now · Edit with assistant ·
// enable toggle). The Town equivalents live on the routine card + action rail.
// ---------------------------------------------------------------------------

function TitleBlock({
	automation,
	onEditWithAssistant,
	onRunNow,
	onToggle,
	runError,
	runPending,
	toggleDisabled,
	toggleError,
}: {
	automation: { description: string | null; name: string; status: string };
	onEditWithAssistant?: () => void;
	onRunNow?: () => void;
	onToggle?: (enabled: boolean) => void;
	runError?: boolean;
	runPending?: boolean;
	toggleDisabled?: boolean;
	toggleError?: boolean;
}) {
	const isEnabled = automation.status === "enabled";
	const isArchived = automation.status === "archived";

	return (
		<div style={{ marginBottom: "20px" }}>
			<h1 style={{ color: "var(--ink)", fontSize: "22px", fontWeight: 500, margin: 0 }}>
				{automation.name}
			</h1>
			{automation.description ? (
				<p
					style={{
						color: "var(--ink-muted)",
						fontSize: "13px",
						lineHeight: "1.6",
						margin: "6px 0 0",
						maxWidth: "620px",
					}}
				>
					{automation.description}
				</p>
			) : null}

			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexWrap: "wrap",
					gap: "8px",
					marginTop: "16px",
				}}
			>
				{onRunNow ? (
					<Button disabled={isArchived || runPending} onClick={onRunNow} variant="secondary">
						<Play size={13} />
						{runPending ? "Starting…" : "Run now"}
					</Button>
				) : null}
				{onEditWithAssistant ? (
					<Button onClick={onEditWithAssistant} variant="secondary">
						<MessageSquare size={13} />
						Edit with assistant
					</Button>
				) : null}
				<span style={{ flex: 1 }} />
				<span style={{ color: "var(--ink-subtle)", fontSize: "12px" }}>
					{isArchived ? "Archived" : isEnabled ? "Enabled" : "Disabled"}
				</span>
				<Toggle
					aria-label={isEnabled ? "Disable automation" : "Enable automation"}
					checked={isEnabled}
					disabled={toggleDisabled}
					onCheckedChange={(enabled) => onToggle?.(enabled)}
				/>
			</div>

			{runError && (
				<p style={{ color: "var(--danger)", fontSize: "12px", margin: "10px 0 0" }}>
					Failed to start run. Try again.
				</p>
			)}
			{toggleError && (
				<p style={{ color: "var(--danger)", fontSize: "12px", margin: "10px 0 0" }}>
					Failed to update status. Try again.
				</p>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page chrome — fixed breadcrumb header (Town keeps "Routines › name" pinned),
// scrollable body underneath. Mirrors the session view's header pattern.
// ---------------------------------------------------------------------------

function DetailChrome({ children, name }: { children: React.ReactNode; name: string }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div className="flex min-h-12 shrink-0 items-center gap-2 px-4 md:min-h-14 md:pr-[var(--app-top-actions-reserve)]">
				<Breadcrumb
					currentTag="span"
					items={[{ href: "/automations", label: "Automations" }, { label: name }]}
				/>
			</div>
			<div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
				<div style={{ margin: "0 auto", maxWidth: "768px", padding: "20px 20px 80px" }}>
					{children}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Inner component (has data)
// ---------------------------------------------------------------------------

function AutomationDetailInner({
	automationId,
	data,
}: {
	automationId: string;
	data: AutomationDetailResponse;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const router = useRouter();
	const searchParams = useSearchParams();
	const activeTab = normalizeTab(searchParams.get("tab"));

	const toggleMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			api.updateAutomation(automationId, { status: enabled ? "enabled" : "disabled" }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
			// The list page caches the same status — keep its rows in sync.
			void queryClient.invalidateQueries({ queryKey: ["automations"] });
		},
	});

	const runMutation = useMutation({
		mutationFn: () => api.runAutomation(automationId),
		onSuccess: (inv) => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
			// The Sessions tab caches invocations separately — make the new run show up.
			void queryClient.invalidateQueries({ queryKey: ["automation-invocations", automationId] });
			router.push(`/automations/${automationId}/runs/${inv.id}`);
		},
	});

	function setTab(tab: TabId) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", tab);
		router.replace(`?${params.toString()}`);
	}

	function handleEditWithAssistant() {
		// Lands on the home composer seeded with this automation's mention chip —
		// sending starts a session where the agent applies the edits.
		stashComposerSeed([
			{ text: "Update " },
			{ chip: automationMentionChip({ id: automationId, name: data.automation.name }) },
			{ text: ": " },
		]);
		router.push("/");
	}

	return (
		<DetailChrome name={data.automation.name}>
			<TitleBlock
				automation={data.automation}
				onEditWithAssistant={handleEditWithAssistant}
				onRunNow={() => runMutation.mutate()}
				onToggle={(enabled) => toggleMutation.mutate(enabled)}
				runError={runMutation.isError}
				runPending={runMutation.isPending}
				toggleDisabled={toggleMutation.isPending || data.automation.status === "archived"}
				toggleError={toggleMutation.isError}
			/>

			<TabNav
				activeId={activeTab}
				ariaLabel="Automation sections"
				className="mb-6"
				items={TABS}
				onSelect={setTab}
			/>

			<PageFade key={activeTab}>
				{activeTab === "sessions" && <SessionsTab automationId={automationId} />}
				{activeTab === "settings" && <SettingsTab automationId={automationId} data={data} />}
				{activeTab === "info" && <InfoTab automationId={automationId} data={data} />}
			</PageFade>
		</DetailChrome>
	);
}

// ---------------------------------------------------------------------------
// Loading states — when the list page already has this automation cached, the
// header + tabs paint instantly and only the tab body shows skeleton rows.
// ---------------------------------------------------------------------------

function AutomationDetailShellSkeleton({ cached }: { cached: AutomationWithRelations }) {
	return (
		<DetailChrome name={cached.automation.name}>
			<TitleBlock automation={cached.automation} toggleDisabled />
			<TabNav
				activeId={"sessions" as TabId}
				ariaLabel="Automation sections"
				className="mb-6"
				items={TABS}
			/>
			<div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
				<GroupCardSkeleton controlWidth={64} rows={3} />
			</div>
		</DetailChrome>
	);
}

function AutomationDetailSkeleton() {
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div className="flex min-h-12 shrink-0 items-center gap-2 px-4 md:min-h-14">
				<Skeleton style={{ height: "12px", width: "180px" }} />
			</div>
			<div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
				<div style={{ margin: "0 auto", maxWidth: "768px", padding: "20px 20px 80px" }}>
					<Skeleton style={{ height: "26px", marginBottom: "10px", width: "240px" }} />
					<Skeleton style={{ height: "13px", marginBottom: "20px", width: "70%" }} />
					<Skeleton style={{ height: "32px", marginBottom: "28px", width: "320px" }} />
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} style={{ height: "52px", marginBottom: "6px", width: "100%" }} />
					))}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

type AutomationDetailProps = {
	automationId: string;
};

export function AutomationDetail({ automationId }: AutomationDetailProps) {
	const api = useApi();
	const queryClient = useQueryClient();

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.getAutomation(automationId),
		queryKey: automationQueryKey(automationId),
		staleTime: AUTOMATION_STALE_TIME,
	});

	if (isLoading) {
		const cached = queryClient
			.getQueryData<AutomationWithRelations[]>(["automations"])
			?.find((item) => item.automation.id === automationId);
		return cached ? (
			<AutomationDetailShellSkeleton cached={cached} />
		) : (
			<AutomationDetailSkeleton />
		);
	}

	if (isError || !data) {
		return (
			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
					padding: "40px 24px",
				}}
			>
				<p style={{ color: "var(--danger)", fontSize: "13px", margin: 0 }}>
					Failed to load automation.
				</p>
				<Button onClick={() => void refetch()} variant="secondary">
					Retry
				</Button>
			</div>
		);
	}

	return <AutomationDetailInner automationId={automationId} data={data} />;
}
