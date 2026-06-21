"use client";

import {
	Fragment,
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/ui/popover";
import { cn } from "@/ui/utils";
import {
	type ComposerChipSpec,
	filterSlashCommands,
	SLASH_COMMANDS,
	type SlashCommand,
} from "./slash-commands";

/**
 * Plain-text composer input that supports inline non-editable chips and a
 * "/" command popover. The contentEditable DOM is the source of truth (React
 * never renders its children — controlled re-renders would fight the caret);
 * the `value` prop is a serialized mirror kept in sync via onChange, and
 * external writes to `value` (suggestion clicks, clearing) replace the DOM.
 */

export type ChipInputSeedPart = { text: string } | { chip: ComposerChipSpec };

export type ChipInputHandle = {
	/** Append a chip at the end (attachment-menu shortcuts). */
	appendChip(chip: ComposerChipSpec): void;
	/** Append plain text at the end (dictation). Returns the new serialized value. */
	appendText(text: string): string;
	clear(): void;
	focus(): void;
	/** Replace all content with the given parts and focus the end (compose seeding). */
	seed(parts: ChipInputSeedPart[]): void;
};

type ChipInputProps = {
	/** Slash-menu entries; defaults to the static create commands. */
	commands?: SlashCommand[];
	disabled?: boolean;
	onChange: (value: string) => void;
	onSubmit: () => void;
	placeholder?: string;
	value: string;
};

// Lucide "zap", inlined because chips are plain DOM nodes, not React children.
const CHIP_ICON_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>';

function createChipNode(chip: ComposerChipSpec): HTMLSpanElement {
	const node = document.createElement("span");
	node.className = "composer-chip";
	node.contentEditable = "false";
	node.dataset.chipId = chip.id;
	node.dataset.chipSerialized = chip.serialized;
	if (chip.color) {
		// Mention chip — colored dot + tint (Town-style), no action icon.
		node.style.background = `${chip.color}1f`;
		node.style.borderColor = `${chip.color}33`;
		node.style.color = chip.color;
		const dot = document.createElement("span");
		dot.style.cssText = `width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${chip.color}`;
		node.appendChild(dot);
	} else {
		node.innerHTML = CHIP_ICON_SVG;
	}
	node.appendChild(document.createTextNode(chip.label));
	return node;
}

function serializeNode(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? "";
	}
	if (node instanceof HTMLElement) {
		if (node.dataset.chipSerialized !== undefined) {
			return node.dataset.chipSerialized;
		}
		if (node.tagName === "BR") {
			return "\n";
		}
		const inner = Array.from(node.childNodes).map(serializeNode).join("");
		// Block elements only appear via odd paste/IME paths; treat as line breaks.
		if (node.tagName === "DIV" || node.tagName === "P") {
			return `\n${inner}`;
		}
		return inner;
	}
	return "";
}

function serialize(root: HTMLElement): string {
	return Array.from(root.childNodes).map(serializeNode).join("");
}

function placeCaretAtEnd(root: HTMLElement) {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(root);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}

/** The "/query" token directly before the caret, if any. */
type SlashContext = { end: number; node: Text; query: string; start: number };

function getSlashContext(root: HTMLElement): SlashContext | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
	const range = selection.getRangeAt(0);
	const node = range.startContainer;
	if (!(node instanceof Text) || !root.contains(node)) return null;
	const upto = (node.textContent ?? "").slice(0, range.startOffset);
	const token = /(?:^|\s)(\/[\w-]*)$/.exec(upto)?.[1];
	if (token === undefined) return null;
	return {
		end: range.startOffset,
		node,
		query: token.slice(1),
		start: upto.length - token.length,
	};
}

export const ChipInput = forwardRef<ChipInputHandle, ChipInputProps>(function ChipInput(
	{ commands = SLASH_COMMANDS, disabled, onChange, onSubmit, placeholder, value },
	ref,
) {
	const editorRef = useRef<HTMLDivElement | null>(null);
	const lastEmittedRef = useRef<string>(value);
	// True between an emitChange and the re-render that delivers it back as
	// `value` — the window where the value prop is behind this input's DOM.
	const pendingEmitRef = useRef(false);
	// Escape dismisses the popover for the current "/" token; remember where
	// that token started so it doesn't pop right back open on the next keyup.
	const dismissedRef = useRef<{ node: Text; start: number } | null>(null);
	const [empty, setEmpty] = useState(value.length === 0);
	const [slash, setSlash] = useState<SlashContext | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	const filtered = filterSlashCommands(slash?.query ?? "", commands);
	const open = slash !== null && filtered.length > 0;

	const emitChange = useCallback((): string => {
		const root = editorRef.current;
		if (!root) return lastEmittedRef.current;
		const next = serialize(root);
		lastEmittedRef.current = next;
		pendingEmitRef.current = true;
		setEmpty(next.trim().length === 0);
		onChange(next);
		return next;
	}, [onChange]);

	const refreshSlash = useCallback(() => {
		const root = editorRef.current;
		if (!root) return;
		const context = getSlashContext(root);
		if (
			context &&
			dismissedRef.current &&
			dismissedRef.current.node === context.node &&
			dismissedRef.current.start === context.start
		) {
			setSlash(null);
			return;
		}
		if (!context) dismissedRef.current = null;
		setSlash(context);
		setActiveIndex(0);
	}, []);

	// External writes (suggestion clicks, post-submit clearing) replace content.
	// While an emit is awaiting its re-render (pendingEmitRef), a differing
	// `value` is a stale closure — StrictMode replays this effect right after
	// a seed()/emit with the previous value, and writing it would stomp the
	// freshly seeded chip nodes with plain text. Skip; the render carrying the
	// emitted value follows and clears the flag.
	useEffect(() => {
		if (value === lastEmittedRef.current) {
			pendingEmitRef.current = false;
			return;
		}
		if (pendingEmitRef.current) return;
		const root = editorRef.current;
		if (!root) return;
		root.textContent = value;
		lastEmittedRef.current = value;
		setEmpty(value.trim().length === 0);
		setSlash(null);
		if (document.activeElement === root) placeCaretAtEnd(root);
	}, [value]);

	const insertChip = useCallback((range: Range, chip: ComposerChipSpec) => {
		const chipNode = createChipNode(chip);
		range.deleteContents();
		range.insertNode(chipNode);
		const space = document.createTextNode(" ");
		chipNode.after(space);
		const selection = window.getSelection();
		if (selection) {
			const caret = document.createRange();
			caret.setStart(space, 1);
			caret.collapse(true);
			selection.removeAllRanges();
			selection.addRange(caret);
		}
	}, []);

	const selectCommand = useCallback(
		(command: SlashCommand) => {
			const context = slash;
			const root = editorRef.current;
			if (!context || !root) return;
			const range = document.createRange();
			range.setStart(context.node, context.start);
			range.setEnd(context.node, context.end);
			insertChip(range, command.chip);
			setSlash(null);
			dismissedRef.current = null;
			emitChange();
			root.focus({ preventScroll: true });
		},
		[emitChange, insertChip, slash],
	);

	useImperativeHandle(
		ref,
		(): ChipInputHandle => ({
			appendChip(chip: ComposerChipSpec) {
				const root = editorRef.current;
				if (!root) return;
				const current = serialize(root);
				if (current.length > 0 && !/\s$/.test(current)) {
					root.appendChild(document.createTextNode(" "));
				}
				root.appendChild(createChipNode(chip));
				root.appendChild(document.createTextNode(" "));
				root.focus({ preventScroll: true });
				placeCaretAtEnd(root);
				emitChange();
			},
			appendText(text: string): string {
				const root = editorRef.current;
				if (!root) return lastEmittedRef.current;
				const clean = text.replace(/\s+/g, " ").trim();
				if (clean) {
					const current = serialize(root);
					const needsSpace = current.length > 0 && !/\s$/.test(current);
					root.appendChild(document.createTextNode(needsSpace ? ` ${clean}` : clean));
					placeCaretAtEnd(root);
				}
				return emitChange();
			},
			clear() {
				const root = editorRef.current;
				if (!root) return;
				root.textContent = "";
				setSlash(null);
				emitChange();
			},
			focus() {
				const root = editorRef.current;
				if (!root) return;
				root.focus({ preventScroll: true });
				placeCaretAtEnd(root);
			},
			seed(parts: ChipInputSeedPart[]) {
				const root = editorRef.current;
				if (!root) return;
				root.textContent = "";
				for (const part of parts) {
					if ("chip" in part) {
						root.appendChild(createChipNode(part.chip));
					} else {
						root.appendChild(document.createTextNode(part.text));
					}
				}
				root.focus({ preventScroll: true });
				placeCaretAtEnd(root);
				setSlash(null);
				emitChange();
			},
		}),
		[emitChange],
	);

	function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
		if (open) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((index) => (index + 1) % filtered.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				const command = filtered[activeIndex] ?? filtered[0];
				if (command) selectCommand(command);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				if (slash) dismissedRef.current = { node: slash.node, start: slash.start };
				setSlash(null);
				return;
			}
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSubmit();
		}
	}

	function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
		e.preventDefault();
		const text = e.clipboardData.getData("text/plain");
		if (!text) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;
		const range = selection.getRangeAt(0);
		range.deleteContents();
		const textNode = document.createTextNode(text);
		range.insertNode(textNode);
		const caret = document.createRange();
		caret.setStart(textNode, textNode.length);
		caret.collapse(true);
		selection.removeAllRanges();
		selection.addRange(caret);
		emitChange();
		refreshSlash();
	}

	return (
		<Popover open={open}>
			<PopoverAnchor asChild>
				<div style={{ position: "relative" }}>
					{/* biome-ignore lint/a11y/useFocusableInteractive lint/a11y/useSemanticElements: contentEditable is required for inline chips. */}
					<div
						aria-label={placeholder ?? "Message"}
						aria-multiline="true"
						className="chip-editor"
						contentEditable={!disabled}
						onBlur={() => setSlash(null)}
						onDrop={(e) => e.preventDefault()}
						onInput={() => {
							emitChange();
							refreshSlash();
						}}
						onKeyDown={onKeyDown}
						onKeyUp={refreshSlash}
						onMouseUp={refreshSlash}
						onPaste={onPaste}
						ref={editorRef}
						role="textbox"
						style={{
							caretColor: "var(--ink)",
							color: "var(--ink)",
							cursor: "text",
							fontSize: "15px",
							lineHeight: "24px",
							maxHeight: "180px",
							minHeight: "28px",
							outline: "none",
							overflowY: "auto",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
						}}
					/>
					{empty && (
						<span
							aria-hidden
							style={{
								color: "var(--ink-subtle)",
								fontSize: "15px",
								left: 0,
								lineHeight: "24px",
								pointerEvents: "none",
								position: "absolute",
								top: 0,
							}}
						>
							{placeholder}
						</span>
					)}
				</div>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				className="max-h-80 w-80 overflow-y-auto p-1"
				onOpenAutoFocus={(e) => e.preventDefault()}
				side="top"
				sideOffset={10}
			>
				{filtered.map((command, index) => {
					const Icon = command.icon;
					const previous = index > 0 ? filtered[index - 1] : undefined;
					const showSection =
						command.section !== undefined && command.section !== previous?.section;
					return (
						<Fragment key={command.chip.id}>
							{showSection && (
								<p
									aria-hidden
									style={{
										color: "var(--ink-subtle)",
										fontSize: "10px",
										fontWeight: 500,
										letterSpacing: "0.04em",
										margin: 0,
										padding: "6px 10px 2px",
										textTransform: "uppercase",
									}}
								>
									{command.section}
								</p>
							)}
							<button
								className={cn(
									"flex w-full items-center gap-2.5 rounded-md border-none bg-transparent px-2.5 py-2 text-left",
									index === activeIndex ? "bg-primary-soft text-ink" : "text-ink-muted",
								)}
								onClick={() => selectCommand(command)}
								onMouseDown={(e) => e.preventDefault()}
								onMouseEnter={() => setActiveIndex(index)}
								type="button"
							>
								{command.chip.color ? (
									<span
										aria-hidden
										style={{
											background: command.chip.color,
											borderRadius: "50%",
											flexShrink: 0,
											height: "7px",
											width: "7px",
										}}
									/>
								) : Icon ? (
									<Icon size={14} style={{ flexShrink: 0 }} />
								) : null}
								<span
									style={{
										flexShrink: 0,
										fontSize: "13px",
										fontWeight: 500,
										maxWidth: "55%",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{command.chip.label}
								</span>
								<span
									style={{
										color: "var(--ink-subtle)",
										fontSize: "12px",
										minWidth: 0,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{command.description}
								</span>
							</button>
						</Fragment>
					);
				})}
			</PopoverContent>
		</Popover>
	);
});
