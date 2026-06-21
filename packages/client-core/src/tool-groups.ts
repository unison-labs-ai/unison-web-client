/**
 * Pure, UI-agnostic grouping of an assistant turn's ordered parts into render
 * blocks, shared by web + mobile so the two group identically. The accordion UI
 * itself stays per-client; this module only decides the block structure and the
 * collapsed/sliding/expanded display mode.
 *
 * See docs/plans/2026-06-17-tool-call-streaming-visualization.md.
 */

/** Number of most-recent tool rows shown while a group is actively streaming. */
export const TOOL_GROUP_WINDOW = 3;

/** Minimal shape of a tool part both clients satisfy. */
export interface GroupableToolRef {
	callId: string;
	tool: string;
}

/** Minimal shape of an assistant part both clients satisfy. */
export interface GroupablePart {
	kind: string;
	tool?: GroupableToolRef;
}

export type RenderBlock<P> =
	| { kind: "text"; part: P }
	| { kind: "tools"; groupId: string; tools: P[] }
	| { kind: "other"; part: P };

export interface GroupPartsOptions<P> {
	/**
	 * Tool parts for which this returns true are NOT folded into the accordion —
	 * they flush the open group and render standalone (e.g. an email-draft
	 * artifact chip, which is user-actionable).
	 */
	isStandalone?: (part: P) => boolean;
}

/**
 * Fold an ordered part list into blocks: runs of consecutive tool parts coalesce
 * into one `tools` block; a `text` part (or any non-tool part) flushes the open
 * group. Reasoning is never a part (it's a turn-level overlay), so interspersed
 * reasoning can't split a group.
 */
export function groupParts<P extends GroupablePart>(
	parts: readonly P[],
	options: GroupPartsOptions<P> = {},
): RenderBlock<P>[] {
	const blocks: RenderBlock<P>[] = [];
	let open: P[] | null = null;

	const flush = () => {
		if (open && open.length > 0) {
			const groupId = open[0]?.tool?.callId ?? `group-${blocks.length}`;
			blocks.push({ kind: "tools", groupId, tools: open });
		}
		open = null;
	};

	for (const part of parts) {
		const isTool = part.kind === "tool" && part.tool != null;
		if (isTool && !options.isStandalone?.(part)) {
			if (!open) {
				open = [];
			}
			open.push(part);
			continue;
		}

		flush();
		if (part.kind === "text") {
			blocks.push({ kind: "text", part });
		} else {
			blocks.push({ kind: "other", part });
		}
	}

	flush();
	return blocks;
}

export type ToolGroupMode = "collapsed" | "expanded" | "sliding";

/**
 * Display mode for a tool group:
 * - `expanded`  — user opened it (sticky); show all rows.
 * - `sliding`   — the live group of a streaming turn; show the most-recent rows.
 * - `collapsed` — settled / history / not the last block; header only.
 */
export function toolGroupMode(args: { isActive: boolean; userExpanded: boolean }): ToolGroupMode {
	if (args.userExpanded) {
		return "expanded";
	}
	return args.isActive ? "sliding" : "collapsed";
}

/** The tool parts a group should render for a given mode. */
export function visibleTools<P>(
	tools: readonly P[],
	mode: ToolGroupMode,
	window = TOOL_GROUP_WINDOW,
): P[] {
	if (mode === "expanded") {
		return [...tools];
	}
	if (mode === "collapsed") {
		return [];
	}
	return tools.length > window ? tools.slice(tools.length - window) : [...tools];
}
