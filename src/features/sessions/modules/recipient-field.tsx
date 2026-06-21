"use client";

import { X } from "lucide-react";
import { Fragment, type ReactNode, useRef, useState } from "react";

import { cn } from "@/ui/utils";

// ---------------------------------------------------------------------------
// Gmail-style recipient fields. Each address is a chip; typing an address +
// Enter/comma/Tab/blur commits it. Arrow keys navigate the chips: from the start
// of the input, ArrowLeft selects the last chip (white ring), again lands the
// caret between chips, again selects the next chip, etc.; Backspace removes a
// selected chip. Cc/Bcc only appear when their button is pressed, and collapse
// again (if empty) once the recipients area loses focus. No contact autocomplete.
// ---------------------------------------------------------------------------

interface Recipient {
	email: string;
	name?: string;
	raw: string;
}

function parseRecipient(token: string): Recipient {
	const trimmed = token.trim();
	const match = /^(.*?)\s*<([^>]+)>$/.exec(trimmed);
	const email = match?.[2]?.trim();

	if (email) {
		return { email, name: match?.[1]?.trim() || undefined, raw: trimmed };
	}

	return { email: trimmed, raw: trimmed };
}

function splitRecipients(value: string): Recipient[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.map(parseRecipient);
}

function joinRecipients(list: Recipient[]): string {
	return list.map((recipient) => recipient.raw).join(", ");
}

function isLikelyEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RecipientField({
	label,
	onChange,
	placeholder,
	trailing,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	placeholder?: string;
	trailing?: ReactNode;
	value: string;
}) {
	const recipients = splitRecipients(value);
	const count = recipients.length;
	const inputEnd = count * 2; // cursor position that means "in the text input"
	const [draft, setDraft] = useState("");
	// 2N+1 positions: even = caret in a gap (gap i is before chip i), odd 2i+1 =
	// chip i selected, inputEnd (=2N) = the text input. Clamped to the live count.
	const [rawCursor, setRawCursor] = useState(inputEnd);
	const cursor = Math.min(rawCursor, inputEnd);
	const inInput = cursor >= inputEnd;
	const inputRef = useRef<HTMLInputElement>(null);
	// Whether the text input holds DOM focus. Chip selection + caret only show
	// while focused (Gmail-style), and the trailing input collapses when blurred
	// so it never forces an empty wrapped line beneath the chips.
	const [focused, setFocused] = useState(false);

	function setCursor(next: number) {
		setRawCursor(Math.max(0, Math.min(inputEnd, next)));
	}

	function commit(text: string) {
		const cleaned = text.replace(/,+$/, "").trim();
		setDraft("");

		if (cleaned) {
			onChange(joinRecipients([...recipients, parseRecipient(cleaned)]));
		}
	}

	function removeAt(index: number) {
		onChange(joinRecipients(recipients.filter((_, current) => current !== index)));
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		const atStart = inputRef.current?.selectionStart === 0 && inputRef.current?.selectionEnd === 0;

		if (!inInput) {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				setCursor(cursor - 1);
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				setCursor(cursor + 1);
			} else if (event.key === "Backspace" || event.key === "Delete") {
				event.preventDefault();
				if (cursor % 2 === 1) {
					const index = (cursor - 1) / 2;
					removeAt(index);
					setRawCursor(index * 2);
				} else if (event.key === "Backspace" && cursor >= 2) {
					removeAt(cursor / 2 - 1);
					setRawCursor(cursor - 2);
				}
			} else if (event.key.length === 1 || event.key === "Escape") {
				// Any typing (or Escape) drops back into the text input.
				setRawCursor(inputEnd);
			}
			return;
		}

		if (event.key === "ArrowLeft" && atStart && draft.length === 0 && count > 0) {
			event.preventDefault();
			setRawCursor(inputEnd - 1);
		} else if ((event.key === "Enter" || event.key === "Tab") && draft.trim()) {
			event.preventDefault();
			commit(draft);
		} else if (event.key === "Backspace" && draft.length === 0 && count > 0) {
			removeAt(count - 1);
		}
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the row only forwards focus to its input
		// biome-ignore lint/a11y/noStaticElementInteractions: the row only forwards focus to its input
		<div
			className="flex min-h-[34px] items-center gap-3 py-1"
			onClick={() => {
				setRawCursor(inputEnd);
				inputRef.current?.focus();
			}}
		>
			<span className="w-7 shrink-0 text-xs text-ink-subtle">{label}</span>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
				{recipients.map((recipient, index) => {
					const selected = focused && cursor === index * 2 + 1;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: index disambiguates duplicate addresses
						<Fragment key={`${recipient.raw}:${index}`}>
							{focused && cursor === index * 2 ? <Caret /> : null}
							{/* biome-ignore lint/a11y/useKeyWithClickEvents: chips are navigated/removed via the input's keyboard handler */}
							{/* biome-ignore lint/a11y/noStaticElementInteractions: a chip is a visual token; a click just forwards selection to the input */}
							<span
								className={cn(
									"inline-flex max-w-full cursor-default items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-xs transition-colors",
									selected
										? "border-(--ink) bg-surface text-ink"
										: isLikelyEmail(recipient.email)
											? "border-(--border) bg-surface text-ink"
											: "border-(--danger-soft) bg-danger-soft text-danger",
								)}
								onClick={(event) => {
									// Click a chip to select it (Gmail-style); Backspace then removes it.
									if ((event.target as HTMLElement).closest("button")) return;
									event.stopPropagation();
									inputRef.current?.focus();
									setRawCursor(index * 2 + 1);
								}}
								onMouseDown={(event) => {
									// Keep the normal cursor and don't blur the input or start a text selection.
									if ((event.target as HTMLElement).closest("button")) return;
									event.preventDefault();
								}}
								title={recipient.email}
							>
								<span className="truncate">{recipient.name ?? recipient.email}</span>
								<button
									aria-label={`Remove ${recipient.email}`}
									className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted hover:text-ink"
									onClick={(event) => {
										event.stopPropagation();
										removeAt(index);
									}}
									type="button"
								>
									<X size={11} />
								</button>
							</span>
						</Fragment>
					);
				})}
				<input
					className={cn(
						"h-6 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle",
						focused || draft.length > 0 || count === 0
							? "min-w-[90px] flex-1"
							: "w-0 flex-none p-0",
						inInput ? "" : "caret-transparent",
					)}
					onBlur={() => {
						setFocused(false);
						commit(draft);
					}}
					onChange={(event) => {
						setRawCursor(inputEnd);
						const next = event.target.value;
						if (next.endsWith(",")) {
							commit(next);
						} else {
							setDraft(next);
						}
					}}
					onFocus={() => {
						setFocused(true);
						setRawCursor(inputEnd);
					}}
					onKeyDown={handleKeyDown}
					placeholder={count === 0 ? placeholder : ""}
					ref={inputRef}
					value={draft}
				/>
			</div>
			{trailing ? <div className="shrink-0">{trailing}</div> : null}
		</div>
	);
}

function Caret() {
	return <span aria-hidden className="-mr-1 inline-block h-4 w-px shrink-0 bg-ink" />;
}

function ToggleButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
	return (
		<button
			className="text-xs text-ink-subtle hover:text-ink"
			// mousedown so the toggle lands before the input's blur can collapse us.
			onMouseDown={(event) => {
				event.preventDefault();
				onClick();
			}}
			type="button"
		>
			{children}
		</button>
	);
}

export function RecipientsSection({
	bcc,
	cc,
	onChange,
	to,
}: {
	bcc: string;
	cc: string;
	onChange: (field: "bcc" | "cc" | "to", value: string) => void;
	to: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [showCc, setShowCc] = useState(() => cc.trim().length > 0);
	const [showBcc, setShowBcc] = useState(() => bcc.trim().length > 0);

	const hasCc = cc.trim().length > 0;
	const hasBcc = bcc.trim().length > 0;
	const ccVisible = showCc || hasCc;
	const bccVisible = showBcc || hasBcc;

	// When focus leaves the whole recipients area, collapse any empty Cc/Bcc so
	// they don't linger — and so they won't reappear just by re-focusing To.
	function handleBlurCapture() {
		requestAnimationFrame(() => {
			const el = containerRef.current;
			if (el && !el.contains(document.activeElement)) {
				if (cc.trim().length === 0) setShowCc(false);
				if (bcc.trim().length === 0) setShowBcc(false);
			}
		});
	}

	return (
		<div className="flex flex-col" onBlurCapture={handleBlurCapture} ref={containerRef}>
			<RecipientField
				label="To"
				onChange={(value) => onChange("to", value)}
				placeholder="Recipients"
				trailing={
					ccVisible && bccVisible ? null : (
						<div className="flex items-center gap-2">
							{ccVisible ? null : <ToggleButton onClick={() => setShowCc(true)}>Cc</ToggleButton>}
							{bccVisible ? null : (
								<ToggleButton onClick={() => setShowBcc(true)}>Bcc</ToggleButton>
							)}
						</div>
					)
				}
				value={to}
			/>
			{ccVisible ? (
				<RecipientField label="Cc" onChange={(value) => onChange("cc", value)} value={cc} />
			) : null}
			{bccVisible ? (
				<RecipientField label="Bcc" onChange={(value) => onChange("bcc", value)} value={bcc} />
			) : null}
		</div>
	);
}
