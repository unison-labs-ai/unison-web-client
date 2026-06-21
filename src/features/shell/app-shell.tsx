"use client";

import { useQuery } from "@tanstack/react-query";
import {
	Check,
	ChevronDown,
	FileText,
	Gauge,
	Home,
	Link2,
	LogOut,
	Menu,
	MessageSquare,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
	Settings,
	Video,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	type CSSProperties,
	type ElementType,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useInternalAccount } from "@/features/observability/use-internal-account";
import { CommandPalette } from "@/features/shell/command-palette";
import { NotificationsButton, NotificationsPanel } from "@/features/shell/notifications-panel";
import { useApi } from "@/lib/api-context";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { UnisonWordmark } from "@/ui/brand/unison-wordmark";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/ui/sheet";
import { cn } from "@/ui/utils";

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
	{ href: "/", icon: Home, label: "Home" },
	{ href: "/sessions", icon: MessageSquare, label: "Sessions" },
	{ href: "/captures", icon: Video, label: "Captures" },
	{ href: "/documents", icon: FileText, label: "Documents" },
	{ href: "/automations", icon: Zap, label: "Automations" },
	{ href: "/connections", icon: Link2, label: "Connections" },
] as const;

const OPERATOR_ITEMS = [{ href: "/settings", icon: Settings, label: "Settings" }] as const;

const COLLAPSED_SIDEBAR_WIDTH = 56;
const EXPANDED_SIDEBAR_WIDTH = 272;
const SIDEBAR_MOTION = "duration-200 ease-out";
const RAIL_CONTENT_MOTION = "transition-opacity duration-150 ease-out will-change-[opacity]";

// ---------------------------------------------------------------------------
// Responsive tiers — layout.md §5
// ---------------------------------------------------------------------------

type Viewport = "phone" | "tablet" | "desktop";

function useViewport(): Viewport {
	// Defaults to desktop on first render; corrects on mount.
	const [viewport, setViewport] = useState<Viewport>("desktop");
	useEffect(() => {
		const phone = window.matchMedia("(max-width: 767px)");
		const tablet = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
		const update = () =>
			setViewport(phone.matches ? "phone" : tablet.matches ? "tablet" : "desktop");
		update();
		phone.addEventListener("change", update);
		tablet.addEventListener("change", update);
		return () => {
			phone.removeEventListener("change", update);
			tablet.removeEventListener("change", update);
		};
	}, []);
	return viewport;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppShellProps {
	children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppShell({ children }: AppShellProps) {
	// null = no explicit preference; tablets then default to the icon rail.
	const [collapsedPref, setCollapsedPref] = useState<boolean | null>(null);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const viewport = useViewport();
	const api = useApi();

	const collapsed = collapsedPref ?? false;

	const { data: approvalsData } = useQuery({
		queryFn: () => api.listPendingApprovals(),
		queryKey: ["approvals", "pending"],
		staleTime: 60_000,
	});
	const approvalsCount = approvalsData?.length ?? 0;

	const { data: me } = useQuery({
		queryFn: () => api.getMe(),
		queryKey: ["me"],
		staleTime: 5 * 60_000,
	});
	const accountName = me?.profile.displayName ?? me?.profile.email ?? "Account";
	const accountInitial = (accountName[0] ?? "?").toUpperCase();

	// Close the mobile nav sheet on navigation.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
	useEffect(() => {
		setMobileNavOpen(false);
		setNotificationsOpen(false);
	}, [pathname]);

	// Global keyboard map — routes-and-navigation.md §4:
	// ⌘K palette · c new session · g h / g s / g a go-to chords.
	const gChordAt = useRef(0);
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setPaletteOpen((o) => !o);
				return;
			}
			const el = document.activeElement;
			const typing =
				el instanceof HTMLInputElement ||
				el instanceof HTMLTextAreaElement ||
				(el instanceof HTMLElement && el.isContentEditable);
			if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

			// Resolve a pending g-chord first; any key that doesn't complete it
			// (including 'c'/'g') cancels the window rather than letting it linger.
			const chordPending = Date.now() - gChordAt.current < 1000;
			gChordAt.current = 0;
			if (chordPending) {
				const target = { a: "/automations", h: "/", s: "/sessions" }[e.key];
				if (target) {
					e.preventDefault();
					router.push(target);
					return;
				}
			}
			if (e.key === "c") {
				e.preventDefault();
				router.push("/sessions/new");
				return;
			}
			if (e.key === "g") {
				gChordAt.current = Date.now();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [router]);

	async function handleSignOut() {
		try {
			const supabase = createBrowserSupabaseClient();
			await supabase.auth.signOut();
			router.push("/sign-in");
		} catch (err) {
			console.error("Sign out failed:", err);
		}
	}

	// Rail geometry — layout.md §4. Gutters collapse to 0 on phones (§5).
	const gutter = 10; // --space-sm
	const sidebarWidth = collapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH;
	const mainMarginLeft = sidebarWidth + gutter * 2;
	// The session module panel now lives inside the page (an in-flow sibling of
	// the chat column), not a shell slot — so main never reflows for a docked
	// panel. Notifications still overlay the canvas.
	const topActionsReserve = approvalsCount > 0 ? "120px" : "80px";

	const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
	const toggleNotifications = useCallback(() => {
		setNotificationsOpen((open) => !open);
	}, []);

	// ------------------------------------------------------------------
	// Phone (≤ sm): top bar + nav sheet + bottom-sheet panel
	// ------------------------------------------------------------------
	if (viewport === "phone") {
		return (
			<div className="bg-background flex min-h-dvh flex-col">
				<header className="bg-background/90 sticky top-0 z-20 flex min-h-[52px] items-center gap-2 border-b border-(--border) px-3 backdrop-blur">
					<button
						aria-label="Open navigation"
						className="text-ink-muted hover:bg-surface hover:text-ink flex items-center justify-center rounded-md border-none bg-transparent p-1"
						onClick={() => setMobileNavOpen(true)}
						type="button"
					>
						<Menu size={18} />
					</button>
					<UnisonWordmark className="h-[17px] w-auto text-ink" />
					<div className="ml-auto flex items-center gap-1">
						<ApprovalsChip count={approvalsCount} />
						<NotificationsButton onClick={toggleNotifications} open={notificationsOpen} />
					</div>
				</header>

				{/* Gutters collapse to 0 on phones — panels go edge-to-edge (layout.md §5). */}
				<main className="min-w-0 flex-1 overflow-auto">{children}</main>

				<Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
					<SheetContent className="w-[280px] p-0" side="left">
						<SheetTitle className="sr-only">Navigation</SheetTitle>
						<RailContent
							accountInitial={accountInitial}
							accountName={accountName}
							avatarUrl={me?.profile.avatarUrl ?? null}
							collapsed={false}
							onOpenPalette={() => {
								setMobileNavOpen(false);
								setPaletteOpen(true);
							}}
							onSignOut={handleSignOut}
							pathname={pathname}
							showHeaderControls={false}
						/>
					</SheetContent>
				</Sheet>

				{/* Notifications — overlay sheet above the canvas */}
				{notificationsOpen && (
					<aside className="bg-surface-muted fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-hidden rounded-t-lg border-t border-(--border) shadow-lg">
						<NotificationsPanel onClose={closeNotifications} />
					</aside>
				)}

				<CommandPalette onOpenChange={setPaletteOpen} open={paletteOpen} />
			</div>
		);
	}

	// ------------------------------------------------------------------
	// Tablet / desktop: floating rail on the canvas
	// ------------------------------------------------------------------
	return (
		<div className="bg-background flex h-dvh overflow-hidden">
			<nav
				className={cn(
					"bg-surface-muted fixed z-10 flex flex-col overflow-hidden rounded-lg ring-1 ring-(--border) transition-[width] will-change-[width]",
					SIDEBAR_MOTION,
				)}
				style={{ bottom: gutter, left: gutter, top: gutter, width: sidebarWidth }}
			>
				<RailContent
					accountInitial={accountInitial}
					accountName={accountName}
					avatarUrl={me?.profile.avatarUrl ?? null}
					collapsed={collapsed}
					onOpenPalette={() => setPaletteOpen(true)}
					onSignOut={handleSignOut}
					onToggleCollapsed={() => setCollapsedPref(!collapsed)}
					pathname={pathname}
					showHeaderControls
				/>
			</nav>

			<main
				className={cn(
					"min-h-0 min-w-0 flex-1 overflow-auto p-[var(--space-sm)] transition-[margin] will-change-[margin]",
					SIDEBAR_MOTION,
				)}
				style={
					{
						"--app-top-actions-reserve": topActionsReserve,
						marginLeft: mainMarginLeft,
					} as CSSProperties
				}
			>
				{children}
			</main>

			{/* Approvals + notifications — top-right overlay above the canvas. */}
			<div className="fixed top-[18px] right-[22px] z-30 flex items-center gap-1">
				<ApprovalsChip count={approvalsCount} />
				<NotificationsButton onClick={toggleNotifications} open={notificationsOpen} />
			</div>

			{/* Notifications — overlay above the canvas; main does not reflow. */}
			{notificationsOpen && (
				<aside
					className="bg-surface-muted fixed z-20 flex flex-col overflow-hidden rounded-lg border border-(--border) shadow-lg"
					style={{
						bottom: gutter,
						right: gutter,
						top: gutter,
						width: "min(380px, calc(100vw - 20px))",
					}}
				>
					<NotificationsPanel onClose={closeNotifications} />
				</aside>
			)}

			<CommandPalette onOpenChange={setPaletteOpen} open={paletteOpen} />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Approvals chip (shared between rail header and phone top bar)
// ---------------------------------------------------------------------------

function ApprovalsChip({ compact = false, count }: { compact?: boolean; count: number }) {
	if (count === 0) return null;
	if (compact) {
		// Icon-rail variant: icon + count badge, mirroring the bell's badge recipe.
		return (
			<Link
				aria-label={`${count} pending approvals`}
				className="text-ink-subtle hover:bg-surface hover:text-ink relative flex h-8 w-8 items-center justify-center rounded-md no-underline"
				href="/approvals"
				title={`${count} pending approvals`}
			>
				<Check size={16} />
				<span
					aria-hidden
					className="bg-danger text-danger-foreground absolute right-0 top-0 flex h-[14px] min-w-[14px] translate-x-[40%] -translate-y-[40%] items-center justify-center rounded-pill px-[3px] text-[10px] font-medium leading-none"
				>
					{count > 9 ? "9+" : count}
				</span>
			</Link>
		);
	}
	return (
		<Link
			className="bg-primary-soft text-ink hover:bg-surface flex items-center gap-1 rounded-pill px-[6px] py-[2px] text-[11px] font-medium no-underline"
			href="/approvals"
			title="Approvals"
		>
			<Check size={10} />
			<span>{count}</span>
		</Link>
	);
}

// ---------------------------------------------------------------------------
// Nav link — module scope so rail re-renders (e.g. approvals refetch) don't
// remount every link and drop keyboard focus.
// ---------------------------------------------------------------------------

interface NavLinkProps {
	collapsed: boolean;
	href: string;
	icon: ElementType;
	label: string;
	pathname: string;
}

function NavLink({ collapsed, href, icon: Icon, label, pathname }: NavLinkProps) {
	const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
	return (
		<Link
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative h-10 overflow-hidden rounded-md text-sm no-underline outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
				"w-full",
				active
					? "bg-surface text-ink hover:bg-surface"
					: "bg-transparent text-ink-muted hover:bg-primary-soft hover:text-ink",
			)}
			href={href}
			title={collapsed ? label : undefined}
		>
			<span className="absolute inset-y-0 left-0 flex h-10 w-10 items-center justify-center">
				<Icon className="shrink-0" size={16} />
			</span>
			<span
				className={cn(
					"pointer-events-none absolute inset-y-0 right-3 left-10 flex items-center overflow-hidden",
					RAIL_CONTENT_MOTION,
					collapsed ? "opacity-0" : "opacity-100",
				)}
			>
				<span className="truncate">{label}</span>
			</span>
		</Link>
	);
}

interface RailActionButtonProps {
	collapsed: boolean;
	icon: ElementType;
	label: string;
	onClick: () => void;
	trailing?: string;
}

function RailActionButton({
	collapsed,
	icon: Icon,
	label,
	onClick,
	trailing,
}: RailActionButtonProps) {
	return (
		<button
			className={cn(
				"relative h-10 overflow-hidden rounded-md text-sm text-ink-subtle outline-none hover:bg-primary-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-(--ring)",
				collapsed
					? "w-full border-none bg-transparent"
					: "w-full border border-(--border) bg-surface",
			)}
			onClick={onClick}
			title={collapsed ? label : undefined}
			type="button"
		>
			<span className="absolute inset-y-0 left-0 flex h-10 w-10 items-center justify-center">
				<Icon size={16} />
			</span>
			<span
				className={cn(
					"pointer-events-none absolute inset-y-0 right-11 left-10 flex items-center overflow-hidden",
					RAIL_CONTENT_MOTION,
					collapsed ? "opacity-0" : "opacity-100",
				)}
			>
				<span className="truncate">{label}</span>
			</span>
			{trailing ? (
				<span
					className={cn(
						"pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs",
						RAIL_CONTENT_MOTION,
						collapsed ? "opacity-0" : "opacity-60",
					)}
				>
					{trailing}
				</span>
			) : null}
		</button>
	);
}

// ---------------------------------------------------------------------------
// Rail content — shared by the fixed rail (tablet/desktop) and the phone sheet
// ---------------------------------------------------------------------------

interface RailContentProps {
	accountInitial: string;
	accountName: string;
	avatarUrl: string | null;
	collapsed: boolean;
	onOpenPalette: () => void;
	onSignOut: () => void;
	onToggleCollapsed?: () => void;
	pathname: string;
	showHeaderControls: boolean;
}

function RailContent({
	accountInitial,
	accountName,
	avatarUrl,
	collapsed,
	onOpenPalette,
	onSignOut,
	onToggleCollapsed,
	pathname,
	showHeaderControls,
}: RailContentProps) {
	// Internal-only Observability item (eval dashboard spec §5). Rendered only
	// once the account has loaded AND is internal — nothing flashes for others.
	const { isInternal } = useInternalAccount();
	return (
		<>
			{/* Rail header keeps the same 40px geometry in both states. */}
			<div className="shrink-0 border-b border-(--border) p-2">
				<div className="relative h-10 overflow-hidden">
					<span
						className={cn(
							"text-ink pointer-events-none absolute inset-y-0 left-2 flex items-center whitespace-nowrap text-[15px] font-medium",
							RAIL_CONTENT_MOTION,
							collapsed ? "opacity-0" : "opacity-100",
						)}
					>
						<UnisonWordmark className="h-[16px] w-auto" />
					</span>
					{showHeaderControls && onToggleCollapsed ? (
						<button
							aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							className={cn(
								"text-ink-subtle hover:bg-surface hover:text-ink absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-md border-none bg-transparent",
							)}
							onClick={onToggleCollapsed}
							type="button"
						>
							{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
						</button>
					) : null}
				</div>
			</div>

			<div className="flex shrink-0 flex-col gap-2 border-b border-(--border) p-2">
				<RailActionButton
					collapsed={collapsed}
					icon={Search}
					label="Search"
					onClick={onOpenPalette}
					trailing="⌘K"
				/>
			</div>

			{/* Primary nav — flex-1 pushes operator rail + account to the bottom */}
			<div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-auto p-2">
				{NAV_ITEMS.map(({ href, icon, label }) => (
					<NavLink
						collapsed={collapsed}
						href={href}
						icon={icon}
						key={href}
						label={label}
						pathname={pathname}
					/>
				))}
			</div>

			{/* Operator rail */}
			<div className="flex shrink-0 flex-col gap-[2px] border-t border-(--border) p-2">
				{isInternal && (
					<NavLink
						collapsed={collapsed}
						href="/observability"
						icon={Gauge}
						label="Observability"
						pathname={pathname}
					/>
				)}
				{OPERATOR_ITEMS.map(({ href, icon, label }) => (
					<NavLink
						collapsed={collapsed}
						href={href}
						icon={icon}
						key={href}
						label={label}
						pathname={pathname}
					/>
				))}
			</div>

			{/* Account chip — Radix dropdown portals the menu out of the rail's
			    overflow-hidden box (the old absolute menu was clipped when collapsed)
			    and brings Esc/focus handling + aria-haspopup/aria-expanded for free. */}
			<div className="shrink-0 px-2 pb-1">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							className={cn(
								"relative h-10 overflow-hidden rounded-md border-none bg-transparent text-left outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-(--ring) data-[state=open]:bg-surface",
								"w-full",
							)}
							title={collapsed ? accountName : undefined}
							type="button"
						>
							<span className="absolute inset-y-0 left-0 flex h-10 w-10 items-center justify-center">
								{avatarUrl ? (
									// biome-ignore lint/performance/noImgElement: avatar from arbitrary Google host; next/image gains nothing here
									<img
										alt=""
										className="bg-surface h-7 w-7 shrink-0 rounded-pill border border-(--border) object-cover"
										src={avatarUrl}
									/>
								) : (
									<div className="bg-surface text-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border border-(--border) text-[11px] font-medium">
										{accountInitial}
									</div>
								)}
							</span>
							<span
								className={cn(
									"text-ink pointer-events-none absolute inset-y-0 right-8 left-10 flex items-center overflow-hidden text-sm font-medium",
									RAIL_CONTENT_MOTION,
									collapsed ? "opacity-0" : "opacity-100",
								)}
							>
								<span className="truncate">{accountName}</span>
							</span>
							<ChevronDown
								className={cn(
									"text-ink-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2",
									RAIL_CONTENT_MOTION,
									collapsed ? "opacity-0" : "opacity-100",
								)}
								size={14}
							/>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align={collapsed ? "end" : "start"}
						side={collapsed ? "right" : "top"}
						sideOffset={6}
					>
						<DropdownMenuItem
							className="text-danger hover:bg-surface-muted hover:text-danger"
							onSelect={onSignOut}
						>
							<LogOut size={14} />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</>
	);
}
