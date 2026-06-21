"use client";

import { useQuery } from "@tanstack/react-query";
import type { BrainSearchHit } from "@unison/contracts";
import {
	BookOpen,
	Home,
	Link2,
	MessageSquare,
	Plus,
	Search,
	Settings,
	Video,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api-context";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/ui/command";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
	{ href: "/", icon: Home, label: "Home", shortcut: "G H" },
	{ href: "/sessions", icon: MessageSquare, label: "Sessions", shortcut: "G S" },
	{ href: "/automations", icon: Zap, label: "Automations", shortcut: "G A" },
	{ href: "/captures", icon: Video, label: "Captures", shortcut: undefined },
	{ href: "/connections", icon: Link2, label: "Connections", shortcut: undefined },
	{ href: "/settings", icon: Settings, label: "Settings", shortcut: undefined },
] as const;

const NEW_SESSION_LABEL = "New Session";

/** Cap per entity group — routes-and-navigation.md §4 jump lists stay scannable. */
const GROUP_LIMIT = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const api = useApi();
	const router = useRouter();
	const [query, setQuery] = useState("");

	// Debounced search query (300 ms) — drives the brain search only; static
	// items and already-fetched entity lists filter on the live query.
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearDebounceTimer = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
	}, []);

	// Don't leak the timer (and a late setState) past unmount.
	useEffect(() => clearDebounceTimer, [clearDebounceTimer]);

	const handleQueryChange = useCallback(
		(value: string) => {
			setQuery(value);
			clearDebounceTimer();
			debounceTimerRef.current = setTimeout(() => {
				setDebouncedQuery(value);
			}, 300);
		},
		[clearDebounceTimer],
	);

	const reset = useCallback(() => {
		clearDebounceTimer();
		setQuery("");
		setDebouncedQuery("");
	}, [clearDebounceTimer]);

	// ---------------------------------------------------------------------------
	// Data — entity jump lists (fetched only while the palette is open)
	// ---------------------------------------------------------------------------

	// Sessions/captures use palette-scoped keys: other surfaces cache the
	// unbounded list under ["threads"]/["captures"], and sharing a key across
	// different fetch args would poison that cache. Automations/connections are
	// the exact same calls as their list pages, so they share keys.
	const sessionsQuery = useQuery({
		enabled: open,
		queryFn: () => api.listThreads({ limit: 100 }),
		queryKey: ["palette", "sessions"],
		staleTime: 30_000,
	});
	const automationsQuery = useQuery({
		enabled: open,
		queryFn: () => api.listAutomations(),
		queryKey: ["automations"],
		staleTime: 30_000,
	});
	const capturesQuery = useQuery({
		enabled: open,
		queryFn: () => api.listCaptures({ limit: 100 }),
		queryKey: ["palette", "captures"],
		staleTime: 30_000,
	});
	const connectionsQuery = useQuery({
		enabled: open,
		queryFn: () => api.listConnections(),
		queryKey: ["connections"],
		staleTime: 30_000,
	});

	// Brain search query
	const {
		data: brainData,
		isFetching: brainFetching,
		isError: brainError,
	} = useQuery({
		enabled: open && debouncedQuery.trim().length >= 2,
		queryFn: () => api.searchBrain({ limit: 5, q: debouncedQuery }),
		queryKey: ["brain-search", debouncedQuery],
		staleTime: 60_000,
	});
	const brainResults: BrainSearchHit[] = brainData?.results ?? [];

	// ---------------------------------------------------------------------------
	// Filtering — cmdk's own filter is off (shouldFilter={false}) so async rows
	// and placeholder items survive; static items match on label instead.
	// ---------------------------------------------------------------------------

	const q = query.trim().toLowerCase();
	const showEntities = q.length >= 2;
	const showBrain = debouncedQuery.trim().length >= 2;

	const navMatches = NAV_ITEMS.filter(({ label }) => q === "" || label.toLowerCase().includes(q));
	const showCreate = q === "" || NEW_SESSION_LABEL.toLowerCase().includes(q);

	const sessionMatches = showEntities
		? (sessionsQuery.data?.threads ?? [])
				.filter((t) => (t.title ?? "Untitled session").toLowerCase().includes(q))
				.slice(0, GROUP_LIMIT)
		: [];
	const automationMatches = showEntities
		? (automationsQuery.data ?? [])
				.filter((a) => a.automation.name.toLowerCase().includes(q))
				.slice(0, GROUP_LIMIT)
		: [];
	const captureMatches = showEntities
		? (capturesQuery.data?.captures ?? [])
				.filter((c) => (c.title ?? "Untitled capture").toLowerCase().includes(q))
				.slice(0, GROUP_LIMIT)
		: [];
	const connectionMatches = showEntities
		? (connectionsQuery.data ?? [])
				.filter((c) => `${c.displayName ?? ""} ${c.provider}`.toLowerCase().includes(q))
				.slice(0, GROUP_LIMIT)
		: [];

	// ---------------------------------------------------------------------------
	// Handlers
	// ---------------------------------------------------------------------------

	function close() {
		onOpenChange(false);
		reset();
	}

	function navigate(href: string) {
		router.push(href);
		close();
	}

	function handleOpenChange(next: boolean) {
		onOpenChange(next);
		if (!next) reset();
	}

	function handleKnowledgeSelect(hit: BrainSearchHit) {
		// Brain paths (/wiki/…, /private/sources/…) aren't app routes and no
		// brain-document surface exists yet — copy the preview instead.
		void navigator.clipboard.writeText(hit.bodyPreview).catch(() => {});
		close();
	}

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	return (
		<CommandDialog onOpenChange={handleOpenChange} open={open} shouldFilter={false}>
			<CommandInput
				onValueChange={handleQueryChange}
				placeholder="Search or go to..."
				value={query}
			/>
			<CommandList>
				<CommandEmpty>{brainFetching ? "Searching…" : "No results."}</CommandEmpty>

				{/* Navigation */}
				{navMatches.length > 0 && (
					<CommandGroup heading="Go to">
						{navMatches.map(({ href, icon: Icon, label, shortcut }) => (
							<CommandItem key={href} onSelect={() => navigate(href)} value={`go-${href}`}>
								<Icon size={15} />
								{label}
								{shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Create actions */}
				{showCreate && (
					<CommandGroup heading="Create">
						<CommandItem onSelect={() => navigate("/sessions/new")} value="create-new-session">
							<Plus size={15} />
							{NEW_SESSION_LABEL}
						</CommandItem>
					</CommandGroup>
				)}

				{/* Entity jump — routes-and-navigation.md §4 */}
				{showEntities && (sessionMatches.length > 0 || sessionsQuery.isError) && (
					<CommandGroup heading="Sessions">
						{sessionMatches.map((session) => (
							<CommandItem
								key={session.id}
								onSelect={() => navigate(`/sessions/${session.id}`)}
								value={`session-${session.id}`}
							>
								<MessageSquare className="text-ink-subtle shrink-0" size={15} />
								<span className="truncate">{session.title ?? "Untitled session"}</span>
							</CommandItem>
						))}
						{sessionsQuery.isError && (
							<CommandItem disabled value="__sessions-error__">
								<span className="text-danger">Couldn't load sessions.</span>
							</CommandItem>
						)}
					</CommandGroup>
				)}

				{showEntities && (automationMatches.length > 0 || automationsQuery.isError) && (
					<CommandGroup heading="Automations">
						{automationMatches.map(({ automation }) => (
							<CommandItem
								key={automation.id}
								onSelect={() => navigate(`/automations/${automation.id}`)}
								value={`automation-${automation.id}`}
							>
								<Zap className="text-ink-subtle shrink-0" size={15} />
								<span className="truncate">{automation.name}</span>
							</CommandItem>
						))}
						{automationsQuery.isError && (
							<CommandItem disabled value="__automations-error__">
								<span className="text-danger">Couldn't load automations.</span>
							</CommandItem>
						)}
					</CommandGroup>
				)}

				{showEntities && (captureMatches.length > 0 || capturesQuery.isError) && (
					<CommandGroup heading="Captures">
						{captureMatches.map((capture) => (
							<CommandItem
								key={capture.id}
								onSelect={() => navigate(`/captures/${capture.id}`)}
								value={`capture-${capture.id}`}
							>
								<Video className="text-ink-subtle shrink-0" size={15} />
								<span className="truncate">{capture.title ?? "Untitled capture"}</span>
							</CommandItem>
						))}
						{capturesQuery.isError && (
							<CommandItem disabled value="__captures-error__">
								<span className="text-danger">Couldn't load captures.</span>
							</CommandItem>
						)}
					</CommandGroup>
				)}

				{showEntities && (connectionMatches.length > 0 || connectionsQuery.isError) && (
					<CommandGroup heading="Connections">
						{connectionMatches.map((connection) => (
							<CommandItem
								key={connection.provider}
								onSelect={() => navigate(`/connections/${connection.provider}`)}
								value={`connection-${connection.provider}`}
							>
								<Link2 className="text-ink-subtle shrink-0" size={15} />
								<span className="truncate">{connection.displayName ?? connection.provider}</span>
							</CommandItem>
						))}
						{connectionsQuery.isError && (
							<CommandItem disabled value="__connections-error__">
								<span className="text-danger">Couldn't load connections.</span>
							</CommandItem>
						)}
					</CommandGroup>
				)}

				{/* Knowledge — brain search hits are informational (no doc surface yet) */}
				{showBrain && (brainFetching || brainError || brainResults.length > 0) && (
					<>
						<CommandSeparator />
						<CommandGroup heading="Knowledge">
							{brainFetching && brainResults.length === 0 && (
								<CommandItem disabled value="__knowledge-loading__">
									<Search className="text-ink-subtle" size={15} />
									<span className="text-ink-subtle">Searching…</span>
								</CommandItem>
							)}
							{brainResults.map((hit) => (
								<CommandItem
									key={hit.id}
									onSelect={() => handleKnowledgeSelect(hit)}
									value={`knowledge-${hit.id}`}
								>
									<BookOpen className="text-ink-subtle shrink-0" size={15} />
									<div className="flex min-w-0 flex-col">
										<span className="text-ink truncate">{hit.title ?? hit.path}</span>
										<span className="text-ink-subtle truncate text-[11px]">
											{hit.bodyPreview.slice(0, 80)}
										</span>
									</div>
								</CommandItem>
							))}
							{brainError && !brainFetching && (
								<CommandItem disabled value="__knowledge-error__">
									<span className="text-danger">Search failed — try again in a moment.</span>
								</CommandItem>
							)}
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
