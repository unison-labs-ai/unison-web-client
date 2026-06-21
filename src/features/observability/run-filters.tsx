"use client";

import { useQuery } from "@tanstack/react-query";
import type { EvalRunStatusWire, EvalSuiteIdWire } from "@unison/contracts";
import { evalRunStatusWireSchema, evalSuiteIdWireSchema } from "@unison/contracts";
import { Calendar as CalendarIcon, Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import type { EvalRunListFilters } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import { Calendar } from "@/ui/calendar";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { cn } from "@/ui/utils";
import { statusLabel } from "./eval-status";

// URL-driven filters, inspector-style: the query string is the source of truth
// so filtered views are shareable and survive reloads.

export type EvalRunFilterState = {
	from: string | null;
	model: string;
	statuses: EvalRunStatusWire[];
	suite: EvalSuiteIdWire | null;
	to: string | null;
};

export function useEvalRunFilters(): EvalRunFilterState {
	const searchParams = useSearchParams();
	const statuses = (searchParams.get("status") ?? "")
		.split(",")
		.map((value) => evalRunStatusWireSchema.safeParse(value))
		.flatMap((result) => (result.success ? [result.data] : []));
	const suiteParse = evalSuiteIdWireSchema.safeParse(searchParams.get("suite"));
	return {
		from: searchParams.get("from"),
		model: searchParams.get("model") ?? "",
		statuses,
		suite: suiteParse.success ? suiteParse.data : null,
		to: searchParams.get("to"),
	};
}

/** Date params carry YYYY-MM-DD; the API takes ISO date-times, so expand the
 * range to whole days (from = start of day, to = end of day, UTC). */
export function filtersToRequest(filters: EvalRunFilterState): EvalRunListFilters {
	return {
		from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
		limit: 50,
		model: filters.model || undefined,
		status: filters.statuses.length > 0 ? filters.statuses : undefined,
		suite: filters.suite ?? undefined,
		to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
	};
}

const STATUS_OPTIONS = evalRunStatusWireSchema.options;
const SUITE_OPTIONS = evalSuiteIdWireSchema.options;

// Filter-chip recipe shared with the sessions list (sessions-list.tsx).
const CHIP_CLASS =
	"rounded-pill border border-(--border) px-[10px] py-1 text-xs hover:bg-primary-soft hover:text-ink";
const CHIP_IDLE = "bg-surface text-ink-subtle";
const CHIP_ACTIVE = "bg-primary-soft font-medium text-ink";

/** SelectTrigger-alike for the popover-based filters, sized to the chip row. */
const TRIGGER_CLASS =
	"flex h-7 items-center gap-1.5 rounded-md border border-(--border) bg-surface px-2.5 text-xs text-ink hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";

type CommitParams = (entries: Record<string, string | null>) => void;

function toIsoDateParam(date: Date): string {
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function parseIsoDateParam(value: string | null): Date | undefined {
	if (!value) return undefined;
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

function formatDay(date: Date): string {
	const sameYear = date.getFullYear() === new Date().getFullYear();
	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		...(sameYear ? {} : { year: "numeric" }),
	});
}

function SuiteFilter({
	commitParams,
	filters,
}: {
	commitParams: CommitParams;
	filters: EvalRunFilterState;
}) {
	return (
		<Select
			onValueChange={(value) => commitParams({ suite: value === "all" ? null : value })}
			value={filters.suite ?? "all"}
		>
			<SelectTrigger aria-label="Suite" className="h-7 w-auto gap-1.5 px-2.5 text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="start">
				<SelectItem className="text-xs" value="all">
					All suites
				</SelectItem>
				{SUITE_OPTIONS.map((suite) => (
					<SelectItem className="text-xs" key={suite} value={suite}>
						{suite}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** Combobox over the models seen on the listed runs (ignoring the model filter
 * itself), with a free-text escape hatch since candidate models are arbitrary
 * strings. */
function ModelFilter({
	commitParams,
	filters,
}: {
	commitParams: CommitParams;
	filters: EvalRunFilterState;
}) {
	const api = useApi();
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	// Same query as the page when no model filter is applied (one cache entry);
	// with one applied, this fetches the unnarrowed list so other models stay
	// offered.
	const optionsRequest = useMemo(
		() => ({ ...filtersToRequest(filters), model: undefined }),
		[filters],
	);
	const { data } = useQuery({
		enabled: open,
		queryFn: () => api.listEvalRuns(optionsRequest),
		queryKey: ["eval-runs", optionsRequest],
		staleTime: 30_000,
	});
	const models = useMemo(
		() => [...new Set((data?.runs ?? []).map((run) => run.candidate.model))].sort(),
		[data],
	);

	const typed = search.trim();
	const showTyped = typed.length > 0 && !models.includes(typed);

	function apply(model: string | null) {
		commitParams({ model });
		setOpen(false);
	}

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (!next) setSearch("");
	}

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger asChild>
				<button
					aria-expanded={open}
					aria-label="Filter by model"
					className={cn(TRIGGER_CLASS, "w-44 justify-between")}
					role="combobox"
					type="button"
				>
					<span className={cn("min-w-0 truncate", filters.model ? "font-mono" : "text-ink-subtle")}>
						{filters.model || "All models"}
					</span>
					<ChevronDown className="text-ink-subtle shrink-0" size={14} />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-0">
				<Command>
					<CommandInput
						className="h-9 text-xs"
						onValueChange={setSearch}
						placeholder="Search models…"
						value={search}
					/>
					<CommandList>
						<CommandGroup>
							<CommandItem className="text-xs" onSelect={() => apply(null)} value="all models">
								All models
								<Check
									className={cn("ml-auto", filters.model ? "opacity-0" : "opacity-100")}
									size={13}
								/>
							</CommandItem>
							{models.map((model) => (
								<CommandItem
									className="font-mono text-xs"
									key={model}
									onSelect={() => apply(model)}
									value={model}
								>
									<span className="min-w-0 truncate">{model}</span>
									<Check
										className={cn("ml-auto", filters.model === model ? "opacity-100" : "opacity-0")}
										size={13}
									/>
								</CommandItem>
							))}
						</CommandGroup>
						{showTyped && (
							<CommandGroup>
								<CommandItem
									className="text-xs"
									forceMount
									onSelect={() => apply(typed)}
									value={`filter:${typed}`}
								>
									Filter by “{typed}”
								</CommandItem>
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function DateRangeFilter({
	commitParams,
	filters,
}: {
	commitParams: CommitParams;
	filters: EvalRunFilterState;
}) {
	const from = parseIsoDateParam(filters.from);
	const to = parseIsoDateParam(filters.to);
	const hasRange = Boolean(from || to);
	const selected: DateRange | undefined = hasRange ? { from, to } : undefined;

	const label =
		from && to
			? `${formatDay(from)} – ${formatDay(to)}`
			: from
				? `From ${formatDay(from)}`
				: to
					? `Until ${formatDay(to)}`
					: "Any date";

	function handleSelect(range: DateRange | undefined) {
		commitParams({
			from: range?.from ? toIsoDateParam(range.from) : null,
			to: range?.to ? toIsoDateParam(range.to) : null,
		});
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					aria-label="Filter by date range"
					className={cn(TRIGGER_CLASS, !hasRange && "text-ink-subtle")}
					type="button"
				>
					<CalendarIcon className="text-ink-subtle shrink-0" size={13} />
					{label}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					defaultMonth={from ?? to}
					mode="range"
					numberOfMonths={1}
					onSelect={handleSelect}
					selected={selected}
				/>
				<div className="flex justify-end border-t border-(--line) px-2 py-1.5">
					<Button
						disabled={!hasRange}
						onClick={() => commitParams({ from: null, to: null })}
						size="sm"
						variant="ghost"
					>
						Clear
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function RunFilters({ filters }: { filters: EvalRunFilterState }) {
	const router = useRouter();

	const commitParams: CommitParams = (entries) => {
		// Read at fire time so concurrent filter edits don't clobber each other.
		const params = new URLSearchParams(window.location.search);
		for (const [key, value] of Object.entries(entries)) {
			if (value) {
				params.set(key, value);
			} else {
				params.delete(key);
			}
		}
		const qs = params.toString();
		router.replace(qs ? `/observability?${qs}` : "/observability");
	};

	function toggleStatus(status: EvalRunStatusWire) {
		const next = filters.statuses.includes(status)
			? filters.statuses.filter((value) => value !== status)
			: [...filters.statuses, status];
		commitParams({ status: next.length > 0 ? next.join(",") : null });
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex flex-wrap items-center gap-1.5">
				{STATUS_OPTIONS.map((status) => (
					<button
						className={cn(CHIP_CLASS, filters.statuses.includes(status) ? CHIP_ACTIVE : CHIP_IDLE)}
						key={status}
						onClick={() => toggleStatus(status)}
						type="button"
					>
						{statusLabel(status)}
					</button>
				))}
			</div>

			<span aria-hidden className="bg-(--line) h-5 w-px" />

			<SuiteFilter commitParams={commitParams} filters={filters} />
			<ModelFilter commitParams={commitParams} filters={filters} />
			<DateRangeFilter commitParams={commitParams} filters={filters} />
		</div>
	);
}
