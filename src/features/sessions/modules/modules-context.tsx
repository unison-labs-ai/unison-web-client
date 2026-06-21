"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { TranscriptTurn } from "@/lib/session-transcript";
import type { Module } from "./types";
import { deriveModules } from "./use-session-modules";

// ---------------------------------------------------------------------------
// Session modules interaction state (plan §6.4). The modules themselves are a
// pure projection of `turns`; this provider owns only the open/closed/active
// state and the panel's open/width. The agent's latest artifact comes to front
// (open + focus) on every create or edit; the user can pin any tab by clicking.
// ---------------------------------------------------------------------------

const PANEL_WIDTH_KEY = "unison.session.module-panel-width";
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 460;

/** The synthetic index module — the session header's artifacts button focuses it. */
export const OVERVIEW_MODULE_ID = "overview";

function transcriptModuleId(captureId: string): string {
	return `transcript:${captureId}`;
}

export function clampPanelWidth(width: number): number {
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

interface ModulesContextValue {
	activeId: string | null;
	activeModule: Module | null;
	closeModule: (id: string) => void;
	closePanel: () => void;
	focusModule: (id: string) => void;
	moduleForCallId: (callId: string) => Module | null;
	modules: Module[];
	openModules: Module[];
	panelOpen: boolean;
	panelWidth: number;
	persistPanelWidth: () => void;
	setPanelWidth: (px: number) => void;
}

const ModulesContext = createContext<ModulesContextValue | null>(null);

export function useModules(): ModulesContextValue {
	const value = useContext(ModulesContext);

	if (!value) {
		throw new Error("useModules must be used within a ModulesProvider");
	}

	return value;
}

export function ModulesProvider({
	captureId,
	captureTitle,
	children,
	turns,
}: {
	/** The session's recording, if any — surfaces a transcript module. */
	captureId?: string | null;
	captureTitle?: string | null;
	children: ReactNode;
	turns: TranscriptTurn[];
}) {
	const {
		byId,
		lastTouchedCallId,
		lastTouchedId,
		moduleIdByCallId,
		modules: derivedModules,
	} = useMemo(() => deriveModules(turns), [turns]);

	// The artifact tabs are the derived (tool-call) modules plus two synthetic
	// ones the agent never "touches": an always-present overview index (the
	// header button focuses it) and, for capture sessions, the recording
	// transcript. Negative seqs keep them ahead of the real artifacts.
	const modules = useMemo<Module[]>(() => {
		const synthetic: Module[] = [
			{
				callIds: [],
				id: OVERVIEW_MODULE_ID,
				kind: "overview",
				seq: -2,
				status: "ready",
				title: "Artifacts",
			},
		];

		if (captureId) {
			synthetic.push({
				callIds: [],
				captureId,
				id: transcriptModuleId(captureId),
				kind: "transcript",
				seq: -1,
				status: "ready",
				title: captureTitle?.trim() || "Transcript",
			});
		}

		return [...synthetic, ...derivedModules];
	}, [derivedModules, captureId, captureTitle]);

	const [closedIds, setClosedIds] = useState<Set<string>>(() => new Set());
	const [manuallyOpenedIds, setManuallyOpenedIds] = useState<Set<string>>(() => new Set());
	const [manualId, setManualId] = useState<string | null>(null);
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelWidth, setPanelWidthState] = useState(DEFAULT_WIDTH);
	const panelWidthRef = useRef(panelWidth);
	panelWidthRef.current = panelWidth;

	// Hydrate the persisted width once on mount (SSR-safe).
	useEffect(() => {
		const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
		const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;

		if (Number.isFinite(parsed)) {
			setPanelWidthState(clampPanelWidth(parsed));
		}
	}, []);

	const openModules = useMemo(
		() => modules.filter((module) => manuallyOpenedIds.has(module.id) || !closedIds.has(module.id)),
		[modules, manuallyOpenedIds, closedIds],
	);

	const openById = useMemo(() => {
		const map = new Map<string, Module>();

		for (const module of openModules) {
			map.set(module.id, module);
		}

		return map;
	}, [openModules]);

	const activeModule =
		(manualId ? openById.get(manualId) : undefined) ?? openModules.at(-1) ?? null;

	// Auto-surface: on every agent create/edit, open the panel, un-close the
	// touched module, and bring it to front. Keyed by callId so it fires once per
	// tool call (not on every render) and re-fires even when the same module is
	// edited again.
	const handledTouchRef = useRef<string | null>(null);
	useEffect(() => {
		if (!lastTouchedCallId || !lastTouchedId) {
			return;
		}

		if (handledTouchRef.current === lastTouchedCallId) {
			return;
		}

		handledTouchRef.current = lastTouchedCallId;
		setClosedIds((prev) => {
			if (!prev.has(lastTouchedId)) {
				return prev;
			}

			const next = new Set(prev);
			next.delete(lastTouchedId);
			return next;
		});
		setManualId(lastTouchedId);
		setPanelOpen(true);
	}, [lastTouchedCallId, lastTouchedId]);

	const focusModule = useCallback((id: string) => {
		setClosedIds((prev) => {
			if (!prev.has(id)) {
				return prev;
			}

			const next = new Set(prev);
			next.delete(id);
			return next;
		});
		setManuallyOpenedIds((prev) => {
			if (prev.has(id)) {
				return prev;
			}

			const next = new Set(prev);
			next.add(id);
			return next;
		});
		setManualId(id);
		setPanelOpen(true);
	}, []);

	const closeModule = useCallback(
		(id: string) => {
			const index = openModules.findIndex((module) => module.id === id);
			const remaining = openModules.filter((module) => module.id !== id);
			const fallback = remaining[index] ?? remaining[index - 1] ?? null;

			setClosedIds((prev) => {
				const next = new Set(prev);
				next.add(id);
				return next;
			});
			setManuallyOpenedIds((prev) => {
				if (!prev.has(id)) {
					return prev;
				}

				const next = new Set(prev);
				next.delete(id);
				return next;
			});
			setManualId((current) => (current === id ? (fallback?.id ?? null) : current));

			if (remaining.length === 0) {
				setPanelOpen(false);
			}
		},
		[openModules],
	);

	const closePanel = useCallback(() => setPanelOpen(false), []);

	const setPanelWidth = useCallback((px: number) => {
		setPanelWidthState(clampPanelWidth(px));
	}, []);

	const persistPanelWidth = useCallback(() => {
		window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidthRef.current));
	}, []);

	const moduleForCallId = useCallback(
		(callId: string) => {
			const id = moduleIdByCallId.get(callId);
			return id ? (byId.get(id) ?? null) : null;
		},
		[moduleIdByCallId, byId],
	);

	const value = useMemo<ModulesContextValue>(
		() => ({
			activeId: activeModule?.id ?? null,
			activeModule,
			closeModule,
			closePanel,
			focusModule,
			moduleForCallId,
			modules,
			openModules,
			panelOpen: panelOpen && openModules.length > 0,
			panelWidth,
			persistPanelWidth,
			setPanelWidth,
		}),
		[
			activeModule,
			closeModule,
			closePanel,
			focusModule,
			moduleForCallId,
			modules,
			openModules,
			panelOpen,
			panelWidth,
			persistPanelWidth,
			setPanelWidth,
		],
	);

	return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}
