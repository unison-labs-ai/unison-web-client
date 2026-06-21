"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AgentToolPermissionDecision,
	AutomationToolBinding,
	AutomationTrigger,
	AutomationTriggerCreateRequest,
} from "@unison/contracts";
import type { LucideIcon } from "lucide-react";
import { Check, Lock, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { useApi } from "@/lib/api-context";
import {
	scheduleSummary,
	TRIGGER_ICONS,
	TRIGGER_TYPE_DESCRIPTIONS,
	TRIGGER_TYPE_LABELS,
	WEEKDAY_OPTIONS,
} from "@/lib/automation-format";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Toggle } from "@/ui/toggle";
import { cn } from "@/ui/utils";

import { buildToolsets, type Toolset, type ToolsetTool } from "./automation-toolsets";

// ---------------------------------------------------------------------------
// Shared two-pane manage dialog (Town's add/edit overlay): a left rail with
// "ON THIS ROUTINE" + add sections, a detail pane on the right.
// ---------------------------------------------------------------------------

const FIELD_LABEL_STYLE: React.CSSProperties = {
	color: "var(--ink-subtle)",
	display: "block",
	fontSize: "12px",
	fontWeight: 500,
	marginBottom: "6px",
};

const CONTROL_STYLE: React.CSSProperties = {
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

function ManageDialog({
	children,
	onOpenChange,
	open,
	rail,
	title,
}: {
	children: React.ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	rail: React.ReactNode;
	title: string;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				aria-describedby={undefined}
				className="max-w-[780px] overflow-hidden bg-surface-muted p-0"
				style={{ width: "92vw" }}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<div style={{ display: "flex", height: "min(560px, 78vh)" }}>
					<div
						style={{
							background: "var(--background)",
							borderRight: "1px solid var(--border)",
							display: "flex",
							flexDirection: "column",
							flexShrink: 0,
							gap: "2px",
							overflowY: "auto",
							padding: "14px 10px",
							width: "264px",
						}}
					>
						{rail}
					</div>
					<div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
						{children}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function RailLabel({ children, topGap }: { children: React.ReactNode; topGap?: boolean }) {
	return (
		<p
			style={{
				color: "var(--ink-subtle)",
				fontSize: "11px",
				fontWeight: 500,
				letterSpacing: "0.05em",
				margin: 0,
				padding: topGap ? "16px 10px 6px" : "0 10px 6px",
				textTransform: "uppercase",
			}}
		>
			{children}
		</p>
	);
}

function RailItem({
	icon: Icon,
	label,
	meta,
	onSelect,
	selected,
}: {
	icon: LucideIcon;
	label: string;
	meta?: React.ReactNode;
	onSelect: () => void;
	selected: boolean;
}) {
	return (
		<button
			className={cn(
				"flex w-full shrink-0 items-center gap-2.5 rounded-md border-none px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
				selected
					? "bg-primary-soft text-ink"
					: "bg-transparent text-ink-muted hover:bg-primary-soft hover:text-ink",
			)}
			onClick={onSelect}
			style={{ fontSize: "13px", minHeight: "34px" }}
			type="button"
		>
			<Icon size={14} style={{ flexShrink: 0, opacity: 0.8 }} />
			<span
				style={{
					flex: 1,
					minWidth: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</span>
			{meta}
		</button>
	);
}

function PaneHeader({ description, title }: { description?: string | null; title: string }) {
	return (
		<div style={{ flexShrink: 0, padding: "20px 24px 0" }}>
			<h2 style={{ color: "var(--ink)", fontSize: "16px", fontWeight: 500, margin: 0 }}>{title}</h2>
			{description ? (
				<p style={{ color: "var(--ink-muted)", fontSize: "12px", margin: "4px 0 0" }}>
					{description}
				</p>
			) : null}
		</div>
	);
}

function PaneEmpty({ icon: Icon, message }: { icon?: LucideIcon; message: string }) {
	return (
		<div
			style={{
				alignItems: "center",
				color: "var(--ink-subtle)",
				display: "flex",
				flex: 1,
				flexDirection: "column",
				fontSize: "13px",
				gap: "10px",
				justifyContent: "center",
				padding: "24px",
				textAlign: "center",
			}}
		>
			{Icon ? <Icon size={18} /> : null}
			{message}
		</div>
	);
}

function PaneFooter({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				alignItems: "center",
				borderTop: "1px solid var(--line)",
				display: "flex",
				flexShrink: 0,
				gap: "10px",
				padding: "14px 24px",
			}}
		>
			{children}
		</div>
	);
}

function PaneError({ children }: { children: React.ReactNode }) {
	return <span style={{ color: "var(--danger)", fontSize: "12px" }}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Triggers modal — left: existing triggers + addable types; right: edit/add.
// ---------------------------------------------------------------------------

const ADDABLE_TRIGGER_TYPES = [
	"manual",
	"schedule",
	"gmail",
	"calendar",
	"meeting",
	"capture",
	"webhook",
] as const;
type AddableTriggerType = (typeof ADDABLE_TRIGGER_TYPES)[number];

// Mirrors the schedule semantics in @unison/automations parseScheduleConfig:
// weekday 0=Sunday, intervalMinutes floored at 15.
const SCHEDULE_FREQUENCIES = [
	"hourly",
	"daily",
	"weekdays",
	"weekly",
	"monthly",
	"interval",
] as const;
type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

type ScheduleFormState = {
	frequency: ScheduleFrequency;
	hour: string;
	intervalMinutes: string;
	minute: string;
	monthDay: string;
	weekday: string;
};

const DEFAULT_SCHEDULE_STATE: ScheduleFormState = {
	frequency: "daily",
	hour: "9",
	intervalMinutes: "60",
	minute: "0",
	monthDay: "1",
	weekday: "1",
};

function clampInt(raw: string, min: number, max: number, fallback: number): number {
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	return Math.min(Math.max(parsed, min), max);
}

function scheduleStateFromConfig(config: Record<string, unknown>): ScheduleFormState {
	const read = (key: string, fallback: string) =>
		typeof config[key] === "number" ? String(config[key]) : fallback;
	const frequency =
		typeof config.frequency === "string" &&
		(SCHEDULE_FREQUENCIES as readonly string[]).includes(config.frequency)
			? (config.frequency as ScheduleFrequency)
			: "daily";
	return {
		frequency,
		hour: read("hour", "9"),
		intervalMinutes: read("intervalMinutes", "60"),
		minute: read("minute", "0"),
		monthDay: read("day", "1"),
		weekday: read("weekday", "1"),
	};
}

function scheduleConfigFromState(
	state: ScheduleFormState,
	timezone: string,
): Record<string, unknown> {
	const hour = clampInt(state.hour, 0, 23, 9);
	const minute = clampInt(state.minute, 0, 59, 0);
	switch (state.frequency) {
		case "interval":
			// The schedule contract floors intervals at 15 minutes (max 1 week).
			return {
				frequency: state.frequency,
				intervalMinutes: clampInt(state.intervalMinutes, 15, 7 * 24 * 60, 60),
				timezone,
			};
		case "hourly":
			return { frequency: state.frequency, minute, timezone };
		case "weekly":
			return {
				frequency: state.frequency,
				hour,
				minute,
				timezone,
				weekday: clampInt(state.weekday, 0, 6, 1),
			};
		case "monthly":
			return {
				day: clampInt(state.monthDay, 1, 31, 1),
				frequency: state.frequency,
				hour,
				minute,
				timezone,
			};
		default:
			// daily / weekdays.
			return { frequency: state.frequency, hour, minute, timezone };
	}
}

function ScheduleFields({
	onChange,
	state,
}: {
	onChange: (next: ScheduleFormState) => void;
	state: ScheduleFormState;
}) {
	const set = (patch: Partial<ScheduleFormState>) => onChange({ ...state, ...patch });
	const showTime =
		state.frequency === "daily" ||
		state.frequency === "weekdays" ||
		state.frequency === "weekly" ||
		state.frequency === "monthly";

	return (
		<div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
			<div style={{ flex: "1 1 140px", maxWidth: "180px" }}>
				<label htmlFor="schedule-frequency" style={FIELD_LABEL_STYLE}>
					Frequency
				</label>
				<select
					className="form-control"
					id="schedule-frequency"
					onChange={(e) => set({ frequency: e.target.value as ScheduleFrequency })}
					style={CONTROL_STYLE}
					value={state.frequency}
				>
					{SCHEDULE_FREQUENCIES.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</div>
			{state.frequency === "weekly" && (
				<div style={{ flex: "1 1 120px", maxWidth: "160px" }}>
					<label htmlFor="schedule-weekday" style={FIELD_LABEL_STYLE}>
						Weekday
					</label>
					<select
						className="form-control"
						id="schedule-weekday"
						onChange={(e) => set({ weekday: e.target.value })}
						style={CONTROL_STYLE}
						value={state.weekday}
					>
						{WEEKDAY_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
			)}
			{state.frequency === "monthly" && (
				<div style={{ flex: "0 1 90px" }}>
					<label htmlFor="schedule-month-day" style={FIELD_LABEL_STYLE}>
						Day
					</label>
					<input
						className="form-control"
						id="schedule-month-day"
						max={31}
						min={1}
						onChange={(e) => set({ monthDay: e.target.value })}
						style={CONTROL_STYLE}
						type="number"
						value={state.monthDay}
					/>
				</div>
			)}
			{showTime && (
				<div style={{ flex: "0 1 90px" }}>
					<label htmlFor="schedule-hour" style={FIELD_LABEL_STYLE}>
						Hour
					</label>
					<input
						className="form-control"
						id="schedule-hour"
						max={23}
						min={0}
						onChange={(e) => set({ hour: e.target.value })}
						style={CONTROL_STYLE}
						type="number"
						value={state.hour}
					/>
				</div>
			)}
			{(showTime || state.frequency === "hourly") && (
				<div style={{ flex: "0 1 90px" }}>
					<label htmlFor="schedule-minute" style={FIELD_LABEL_STYLE}>
						Minute
					</label>
					<input
						className="form-control"
						id="schedule-minute"
						max={59}
						min={0}
						onChange={(e) => set({ minute: e.target.value })}
						style={CONTROL_STYLE}
						type="number"
						value={state.minute}
					/>
				</div>
			)}
			{state.frequency === "interval" && (
				<div style={{ flex: "0 1 140px" }}>
					<label htmlFor="schedule-interval" style={FIELD_LABEL_STYLE}>
						Every (minutes)
					</label>
					<input
						className="form-control"
						id="schedule-interval"
						max={7 * 24 * 60}
						min={15}
						onChange={(e) => set({ intervalMinutes: e.target.value })}
						style={CONTROL_STYLE}
						type="number"
						value={state.intervalMinutes}
					/>
				</div>
			)}
		</div>
	);
}

type TriggerSelection =
	| { kind: "trigger"; triggerId: string }
	| { kind: "add"; type: AddableTriggerType };

function browserTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Edit pane for an existing trigger — config selects apply on change, the
 * display name on blur (Town's panes have no save button). */
function TriggerEditPane({
	automationId,
	trigger,
	onRemoved,
}: {
	automationId: string;
	onRemoved: () => void;
	trigger: AutomationTrigger;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const [schedule, setSchedule] = useState<ScheduleFormState>(() =>
		scheduleStateFromConfig(trigger.config),
	);

	const updateMutation = useMutation({
		mutationFn: (request: Parameters<typeof api.updateAutomationTrigger>[2]) =>
			api.updateAutomationTrigger(automationId, trigger.id, request),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
		},
	});

	const removeMutation = useMutation({
		mutationFn: () => api.disableAutomationTrigger(automationId, trigger.id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
			onRemoved();
		},
	});

	function commitSchedule(next: ScheduleFormState) {
		setSchedule(next);
		const timezone =
			typeof trigger.config.timezone === "string" ? trigger.config.timezone : browserTimezone();
		updateMutation.mutate({ config: scheduleConfigFromState(next, timezone) });
	}

	function commitDisplayName(raw: string) {
		const name = raw.trim();
		const current = trigger.displayName ?? "";
		if (name === current) return;
		updateMutation.mutate({ displayName: name.length > 0 ? name : null });
	}

	const typeLabel = TRIGGER_TYPE_LABELS[trigger.triggerType] ?? trigger.triggerType;

	return (
		<>
			<PaneHeader
				description={TRIGGER_TYPE_DESCRIPTIONS[trigger.triggerType] ?? null}
				title={typeLabel}
			/>
			<div
				style={{
					display: "flex",
					flex: 1,
					flexDirection: "column",
					gap: "16px",
					overflowY: "auto",
					padding: "20px 24px",
				}}
			>
				<div style={{ maxWidth: "320px" }}>
					<label htmlFor="trigger-display-name" style={FIELD_LABEL_STYLE}>
						Display name (optional)
					</label>
					<input
						className="form-control"
						defaultValue={trigger.displayName ?? ""}
						id="trigger-display-name"
						key={trigger.id}
						maxLength={160}
						onBlur={(e) => commitDisplayName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") (e.target as HTMLInputElement).blur();
						}}
						placeholder={typeLabel}
						style={CONTROL_STYLE}
						type="text"
					/>
				</div>

				{trigger.triggerType === "schedule" ? (
					<>
						<ScheduleFields onChange={commitSchedule} state={schedule} />
						<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: 0 }}>
							{scheduleSummary(
								scheduleConfigFromState(
									schedule,
									typeof trigger.config.timezone === "string"
										? trigger.config.timezone
										: browserTimezone(),
								),
							)}
						</p>
					</>
				) : (
					<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: 0 }}>
						No other configuration for this trigger.
					</p>
				)}
			</div>
			<PaneFooter>
				<Button
					disabled={removeMutation.isPending}
					onClick={() => removeMutation.mutate()}
					variant="destructive"
				>
					{removeMutation.isPending ? "Removing…" : "Remove"}
				</Button>
				{updateMutation.isError && <PaneError>Couldn&rsquo;t save the change.</PaneError>}
				{removeMutation.isError && <PaneError>Couldn&rsquo;t remove the trigger.</PaneError>}
			</PaneFooter>
		</>
	);
}

/** Add pane for a trigger type — config (schedule only) + an Add footer. */
function TriggerAddPane({
	automationId,
	onAdded,
	type,
}: {
	automationId: string;
	onAdded: (triggerId: string | null) => void;
	type: AddableTriggerType;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const [schedule, setSchedule] = useState<ScheduleFormState>(DEFAULT_SCHEDULE_STATE);

	const addMutation = useMutation({
		mutationFn: (request: AutomationTriggerCreateRequest) =>
			api.createAutomationTrigger(automationId, request),
		onSuccess: (response, request) => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
			// The action response carries the full trigger list — select the newest
			// row of the type we just created so the pane flips to its edit view.
			const created = [...response.triggers]
				.filter((t) => t.triggerType === request.triggerType)
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
			onAdded(created?.id ?? null);
		},
	});

	function handleAdd() {
		addMutation.mutate({
			config: type === "schedule" ? scheduleConfigFromState(schedule, browserTimezone()) : {},
			enabled: true,
			gateConfig: {},
			sourceAccountScope: {},
			triggerType: type,
		});
	}

	return (
		<>
			<PaneHeader
				description={TRIGGER_TYPE_DESCRIPTIONS[type] ?? null}
				title={TRIGGER_TYPE_LABELS[type] ?? type}
			/>
			{type === "schedule" ? (
				<div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
					<ScheduleFields onChange={setSchedule} state={schedule} />
					<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: "14px 0 0" }}>
						{scheduleSummary(scheduleConfigFromState(schedule, browserTimezone()))}
					</p>
				</div>
			) : (
				<PaneEmpty icon={SlidersHorizontal} message="No configuration needed for this trigger." />
			)}
			<PaneFooter>
				<Button disabled={addMutation.isPending} onClick={handleAdd}>
					{addMutation.isPending ? "Adding…" : "Add trigger"}
				</Button>
				{addMutation.isError && (
					<PaneError>
						{addMutation.error instanceof Error
							? addMutation.error.message
							: "Couldn't add the trigger."}
					</PaneError>
				)}
			</PaneFooter>
		</>
	);
}

export function TriggersModal({
	automationId,
	initialSelection,
	onOpenChange,
	open,
	triggers,
}: {
	automationId: string;
	/** Trigger id to preselect (row click on the settings card). */
	initialSelection: string | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	triggers: AutomationTrigger[];
}) {
	const [selection, setSelection] = useState<TriggerSelection | null>(null);
	// Re-derive the selection each time the dialog opens for a (new) target.
	const [seenKey, setSeenKey] = useState<string | null>(null);
	const openKey = open ? `${automationId}:${initialSelection ?? ""}` : null;
	if (openKey !== seenKey) {
		setSeenKey(openKey);
		if (openKey !== null) {
			setSelection(initialSelection ? { kind: "trigger", triggerId: initialSelection } : null);
		}
	}

	const selectedTrigger =
		selection?.kind === "trigger"
			? (triggers.find((t) => t.id === selection.triggerId) ?? null)
			: null;

	return (
		<ManageDialog
			onOpenChange={onOpenChange}
			open={open}
			rail={
				<>
					{triggers.length > 0 && <RailLabel>On this automation</RailLabel>}
					{triggers.map((trigger) => {
						const Icon = TRIGGER_ICONS[trigger.triggerType] ?? SlidersHorizontal;
						return (
							<RailItem
								icon={Icon}
								key={trigger.id}
								label={
									trigger.displayName ??
									TRIGGER_TYPE_LABELS[trigger.triggerType] ??
									trigger.triggerType
								}
								onSelect={() => setSelection({ kind: "trigger", triggerId: trigger.id })}
								selected={selection?.kind === "trigger" && selection.triggerId === trigger.id}
							/>
						);
					})}
					<RailLabel topGap={triggers.length > 0}>Add a trigger</RailLabel>
					{ADDABLE_TRIGGER_TYPES.map((type) => {
						const Icon = TRIGGER_ICONS[type] ?? SlidersHorizontal;
						return (
							<RailItem
								icon={Icon}
								key={type}
								label={TRIGGER_TYPE_LABELS[type] ?? type}
								onSelect={() => setSelection({ kind: "add", type })}
								selected={selection?.kind === "add" && selection.type === type}
							/>
						);
					})}
				</>
			}
			title="Manage triggers"
		>
			{selectedTrigger ? (
				<TriggerEditPane
					automationId={automationId}
					key={selectedTrigger.id}
					onRemoved={() => setSelection(null)}
					trigger={selectedTrigger}
				/>
			) : selection?.kind === "add" ? (
				<TriggerAddPane
					automationId={automationId}
					key={selection.type}
					onAdded={(triggerId) => setSelection(triggerId ? { kind: "trigger", triggerId } : null)}
					type={selection.type}
				/>
			) : (
				<PaneEmpty message="Select a trigger on the left to add or edit." />
			)}
		</ManageDialog>
	);
}

// ---------------------------------------------------------------------------
// Tools modal — left: toolsets on the automation + addable toolsets; right:
// the set's tools with an enable toggle and per-tool approval mode.
// ---------------------------------------------------------------------------

const APPROVAL_OPTIONS: {
	description: string;
	label: string;
	value: AgentToolPermissionDecision | null;
}[] = [
	{ description: "Follows the execution mode", label: "Auto", value: null },
	{
		description: "Requires approval before each use",
		label: "Ask each time",
		value: "ask_for_approval",
	},
	{ description: "Runs without asking", label: "Always allow", value: "always_allow" },
];

type BindingPatch = { enabled?: boolean; permissionOverride?: AgentToolPermissionDecision | null };

function ToolRow({
	disabled,
	enabled,
	onSetEnabled,
	onSetOverride,
	override,
	tool,
}: {
	disabled: boolean;
	enabled: boolean;
	onSetEnabled: (enabled: boolean) => void;
	onSetOverride: (override: AgentToolPermissionDecision | null) => void;
	override: AgentToolPermissionDecision | null;
	tool: ToolsetTool;
}) {
	const lockText =
		tool.floor === "fixed"
			? "Fixed — security floor"
			: tool.floor === "approval"
				? "Floor: approval required"
				: null;

	return (
		<div
			style={{
				alignItems: "center",
				display: "flex",
				gap: "12px",
				padding: "12px 24px",
			}}
		>
			<div style={{ flex: 1, minWidth: 0 }}>
				<p style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500, margin: 0 }}>
					{tool.title}
				</p>
				{tool.description ? (
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
						{tool.description}
					</p>
				) : null}
			</div>

			{lockText ? (
				<span title={lockText}>
					<Lock size={12} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
				</span>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							aria-label={`Approval mode for ${tool.title}`}
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-ink-subtle outline-none hover:bg-primary-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-(--ring) data-[state=open]:bg-primary-soft data-[state=open]:text-ink"
							type="button"
						>
							<MoreHorizontal size={15} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[230px]">
						<p
							style={{
								borderBottom: "1px solid var(--line)",
								color: "var(--ink-subtle)",
								fontSize: "11px",
								fontWeight: 500,
								margin: "0 0 4px",
								padding: "6px 8px 8px",
							}}
						>
							Approval mode
						</p>
						{APPROVAL_OPTIONS.map((option) => (
							<DropdownMenuItem key={option.label} onSelect={() => onSetOverride(option.value)}>
								<Check
									size={13}
									style={{
										flexShrink: 0,
										visibility: override === option.value ? "visible" : "hidden",
									}}
								/>
								<span style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
									<span style={{ color: "var(--ink)", fontSize: "13px" }}>{option.label}</span>
									<span style={{ color: "var(--ink-subtle)", fontSize: "11px" }}>
										{option.description}
									</span>
								</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			<Toggle
				aria-label={`${enabled ? "Disable" : "Enable"} ${tool.title}`}
				checked={enabled}
				disabled={disabled}
				onCheckedChange={onSetEnabled}
			/>
		</div>
	);
}

export function ToolsModal({
	automationId,
	initialToolsetId,
	onOpenChange,
	open,
	toolBindings,
}: {
	automationId: string;
	/** Toolset to preselect (row click on the settings card). */
	initialToolsetId: string | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	toolBindings: AutomationToolBinding[];
}) {
	const api = useApi();
	const queryClient = useQueryClient();

	const catalogQuery = useQuery({
		enabled: open,
		queryFn: () => api.listTools(),
		queryKey: ["tool-catalog"],
		staleTime: 30_000,
	});

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [seenKey, setSeenKey] = useState<string | null>(null);
	// Local overlay of in-flight/applied changes — bindings refresh async after
	// each PATCH, so rows render overlay-first to stay responsive.
	const [overlay, setOverlay] = useState<Map<string, BindingPatch>>(new Map());
	const openKey = open ? `${automationId}:${initialToolsetId ?? ""}` : null;
	if (openKey !== seenKey) {
		setSeenKey(openKey);
		if (openKey !== null) {
			setSelectedId(initialToolsetId);
			setOverlay(new Map());
		}
	}

	const toolsets = useMemo(
		() => buildToolsets(catalogQuery.data?.tools ?? [], toolBindings),
		[catalogQuery.data, toolBindings],
	);

	const bindingByName = useMemo(
		() => new Map(toolBindings.map((binding) => [binding.toolName, binding])),
		[toolBindings],
	);

	function rowState(toolName: string): {
		enabled: boolean;
		override: AgentToolPermissionDecision | null;
	} {
		const binding = bindingByName.get(toolName);
		const patch = overlay.get(toolName);
		return {
			enabled: patch?.enabled !== undefined ? patch.enabled : (binding?.enabled ?? false),
			override:
				patch && "permissionOverride" in patch
					? (patch.permissionOverride ?? null)
					: (binding?.permissionOverride ?? null),
		};
	}

	/** Enabled count for the rail badges, overlay included. */
	function liveEnabledCount(set: Toolset): number {
		return set.tools.filter((tool) => rowState(tool.name).enabled).length;
	}

	const saveMutation = useMutation({
		mutationFn: (input: { patch: BindingPatch; toolName: string }) =>
			api.updateAutomationTools(automationId, {
				toolBindings: [{ toolName: input.toolName, ...input.patch }],
			}),
		onMutate: (input) => {
			setOverlay((previous) => {
				const next = new Map(previous);
				next.set(input.toolName, { ...next.get(input.toolName), ...input.patch });
				return next;
			});
		},
		onError: (_error, input) => {
			// Drop the optimistic patch — the row falls back to the server state.
			setOverlay((previous) => {
				const next = new Map(previous);
				next.delete(input.toolName);
				return next;
			});
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
		},
	});

	const selected = toolsets.find((set) => set.id === selectedId) ?? null;
	const onAutomation = toolsets.filter((set) => liveEnabledCount(set) > 0);
	const addable = toolsets.filter((set) => liveEnabledCount(set) === 0);

	return (
		<ManageDialog
			onOpenChange={onOpenChange}
			open={open}
			rail={
				catalogQuery.isLoading ? (
					<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: 0, padding: "0 10px" }}>
						Loading tools…
					</p>
				) : catalogQuery.isError ? (
					<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0, padding: "0 10px" }}>
						Failed to load the tool catalog.
					</p>
				) : (
					<>
						{onAutomation.length > 0 && <RailLabel>On this automation</RailLabel>}
						{onAutomation.map((set) => (
							<RailItem
								icon={set.icon}
								key={set.id}
								label={set.label}
								meta={
									<span style={{ color: "var(--ink-subtle)", flexShrink: 0, fontSize: "12px" }}>
										{liveEnabledCount(set)}
									</span>
								}
								onSelect={() => setSelectedId(set.id)}
								selected={selectedId === set.id}
							/>
						))}
						{addable.length > 0 && (
							<RailLabel topGap={onAutomation.length > 0}>Add tools</RailLabel>
						)}
						{addable.map((set) => (
							<RailItem
								icon={set.icon}
								key={set.id}
								label={set.label}
								onSelect={() => setSelectedId(set.id)}
								selected={selectedId === set.id}
							/>
						))}
					</>
				)
			}
			title="Manage tools"
		>
			{selected ? (
				<>
					<PaneHeader title={selected.label} />
					<div
						className="group-card"
						style={{
							display: "flex",
							flex: 1,
							flexDirection: "column",
							marginTop: "12px",
							overflowY: "auto",
						}}
					>
						{selected.tools.map((tool) => {
							const state = rowState(tool.name);
							return (
								<ToolRow
									disabled={
										saveMutation.isPending && saveMutation.variables?.toolName === tool.name
									}
									enabled={state.enabled}
									key={tool.name}
									onSetEnabled={(enabled) =>
										saveMutation.mutate({ patch: { enabled }, toolName: tool.name })
									}
									onSetOverride={(permissionOverride) =>
										saveMutation.mutate({ patch: { permissionOverride }, toolName: tool.name })
									}
									override={state.override}
									tool={tool}
								/>
							);
						})}
					</div>
					{saveMutation.isError && (
						<PaneFooter>
							<PaneError>Couldn&rsquo;t save the change — try again.</PaneError>
						</PaneFooter>
					)}
				</>
			) : (
				<PaneEmpty message="Select a toolset on the left to manage its tools." />
			)}
		</ManageDialog>
	);
}
