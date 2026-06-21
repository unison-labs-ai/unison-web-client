"use client";

import { useQuery } from "@tanstack/react-query";
import type { ThreadMessageSendResponse } from "@unison/contracts";
import { ArrowUp, ImagePlus, Loader2, Mic, Plus, Square, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { AttachmentStrip } from "@/features/composer/attachment-strip";
import { ChipInput, type ChipInputHandle } from "@/features/composer/chip-input";
import { DictationWaveform, formatElapsed } from "@/features/composer/dictation-visuals";
import { buildSlashCommands } from "@/features/composer/slash-commands";
import { useDictationControls } from "@/features/composer/use-dictation-controls";
import { useImageAttachments } from "@/features/composer/use-image-attachments";
import { useRealtimeTranscription } from "@/features/composer/use-realtime-transcription";
import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { cn } from "@/ui/utils";

type SessionComposerProps = {
	isStreaming?: boolean;
	/** The in-flight turn's agent-run id; stop targets it precisely when known. */
	liveTurnId?: string | null;
	/** Receives the send 202 so the view can merge messages + attach the stream. */
	onResponse?: (response: ThreadMessageSendResponse) => void;
	threadId: string;
};

export function SessionComposer({
	isStreaming,
	liveTurnId,
	onResponse,
	threadId,
}: SessionComposerProps) {
	const api = useApi();
	const imageInputRef = useRef<HTMLInputElement | null>(null);
	const chipInputRef = useRef<ChipInputHandle | null>(null);
	const [value, setValue] = useState("");
	const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [stopping, setStopping] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const transcription = useRealtimeTranscription();

	// The "/" menu lists "create automation" plus the user's automations as
	// mention chips — same builder and shared cache key as the home composer, so
	// the popover behaves identically in-session.
	const automationsQuery = useQuery({
		queryFn: () => api.listAutomations(),
		queryKey: ["automations"],
		staleTime: 30_000,
	});
	const slashCommands = useMemo(
		() => buildSlashCommands(automationsQuery.data ?? []),
		[automationsQuery.data],
	);

	const dictating =
		transcription.state === "recording" ||
		transcription.state === "starting" ||
		transcription.state === "stopping";
	const dictationBusy = transcription.state === "starting" || transcription.state === "stopping";

	const ensureUploadThread = useCallback(async () => ({ id: threadId }), [threadId]);
	const {
		addFiles,
		attachmentPayload,
		attachments,
		canAddMore,
		clearAttachments,
		hasPendingAttachments,
		removeAttachment,
	} = useImageAttachments({
		disabled: submitting,
		ensureThread: ensureUploadThread,
		getDraftTitle: () => value,
		onError: setError,
	});

	async function handleSend(explicitValue?: string) {
		const text = (explicitValue ?? value).trim();
		// "Respond while it works" — the composer stays live mid-turn (screens.md §3).
		if (submitting || hasPendingAttachments || (!text && attachmentPayload.length === 0)) return;
		setSubmitting(true);
		setError(null);
		try {
			const response = await api.sendThreadMessage(threadId, {
				attachments: attachmentPayload,
				content: text,
			});
			chipInputRef.current?.clear();
			clearAttachments();
			onResponse?.(response);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to send");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleStop() {
		if (stopping) return;
		setStopping(true);
		setError(null);
		try {
			// Omitting sessionId cancels the latest active run; passing the live
			// turn's run id targets it precisely.
			const stopped = await api.stopThreadGeneration({
				sessionId: liveTurnId ?? undefined,
				threadId,
			});
			if (!stopped) {
				setError("Nothing to stop — the turn already finished.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to stop");
		} finally {
			setStopping(false);
		}
	}

	const { cancelDictation, sendDictation, startDictation, stopDictation } = useDictationControls({
		appendTranscript: (transcript) => chipInputRef.current?.appendText(transcript) ?? value,
		canStart: () => !submitting && !dictating,
		focusInput: () => chipInputRef.current?.focus(),
		setError,
		submit: (nextValue) => handleSend(nextValue),
		transcription,
	});

	function focusComposer(e: React.MouseEvent<HTMLFieldSetElement>) {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		if (
			target.closest(
				"button, textarea, a, input, select, [contenteditable], [data-no-composer-focus]",
			)
		)
			return;
		e.preventDefault();
		chipInputRef.current?.focus();
	}

	const displayError = error ?? transcription.error;
	const sendDisabled =
		submitting || hasPendingAttachments || (!value.trim() && attachmentPayload.length === 0);
	// One trailing button: while a turn is live and there is nothing to send it
	// is Stop; the moment a draft exists it morphs back into Send ("respond
	// while it works", screens.md §3).
	const showStop = Boolean(isStreaming) && !submitting && !value.trim() && attachments.length === 0;

	return (
		<fieldset
			className={cn(
				"m-0 min-w-0 rounded-lg border border-(--border) bg-surface-muted",
				"hover:border-[rgba(251,252,252,0.16)] focus-within:border-[rgba(251,252,252,0.16)]",
			)}
			aria-label="Message composer"
			onMouseDown={focusComposer}
			style={{
				borderRadius: "22px",
				cursor: "text",
				padding: "12px 14px 10px",
			}}
		>
			<AttachmentStrip attachments={attachments} onRemove={removeAttachment} />
			<ChipInput
				commands={slashCommands}
				disabled={submitting}
				onChange={setValue}
				onSubmit={() => void handleSend()}
				placeholder={isStreaming ? "Respond while it works…" : "Message…"}
				ref={chipInputRef}
				value={value}
			/>
			<div
				style={{
					alignItems: "center",
					display: "flex",
					gap: "8px",
					marginTop: "6px",
					minHeight: "36px",
				}}
			>
				<div data-no-composer-focus>
					{dictating ? (
						<Button
							aria-label="Cancel dictation"
							disabled={dictationBusy}
							onClick={() => void cancelDictation()}
							size="icon"
							style={{ borderRadius: "50%", height: "34px", width: "34px" }}
							type="button"
							variant="ghost"
						>
							<X size={18} />
						</Button>
					) : (
						<>
							<DropdownMenu onOpenChange={setAttachmentMenuOpen} open={attachmentMenuOpen}>
								<DropdownMenuTrigger asChild>
									<Button
										aria-label="Add attachment"
										className="data-[state=open]:bg-primary-soft data-[state=open]:text-ink"
										disabled={submitting || !canAddMore}
										size="icon"
										style={{ borderRadius: "50%", height: "34px", width: "34px" }}
										type="button"
										variant="ghost"
									>
										<Plus size={19} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" side="top" sideOffset={6}>
									<DropdownMenuItem
										className="text-ink hover:bg-primary-soft hover:text-ink data-[highlighted]:bg-primary-soft data-[highlighted]:text-ink"
										onSelect={() => {
											setAttachmentMenuOpen(false);
											imageInputRef.current?.click();
										}}
									>
										<ImagePlus size={16} />
										Image
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<input
								accept="image/jpeg,image/png,image/webp"
								hidden
								multiple
								onChange={(event) => {
									void addFiles(event.currentTarget.files);
									event.currentTarget.value = "";
								}}
								ref={imageInputRef}
								type="file"
							/>
						</>
					)}
				</div>
				{dictating ? (
					<>
						<DictationWaveform analyserRef={transcription.analyserRef} />
						<span
							className="type-small"
							style={{ color: "var(--ink-muted)", flexShrink: 0, minWidth: "38px" }}
						>
							{formatElapsed(transcription.elapsedMs)}
						</span>
						<Button
							aria-label="Stop dictation"
							disabled={dictationBusy}
							onClick={() => void stopDictation()}
							size="icon"
							style={{ borderRadius: "50%", height: "34px", width: "34px" }}
							type="button"
							variant="secondary"
						>
							{dictationBusy ? (
								<Loader2 className="animate-spin" size={13} />
							) : (
								<Square size={13} />
							)}
						</Button>
						<Button
							aria-label="Send dictated message"
							disabled={dictationBusy || submitting || hasPendingAttachments}
							onClick={() => void sendDictation()}
							size="icon"
							style={{ borderRadius: "50%", height: "34px", width: "34px" }}
							type="button"
						>
							<ArrowUp size={14} />
						</Button>
					</>
				) : (
					<>
						<div style={{ flex: 1 }} />
						<Button
							aria-label="Start dictation"
							disabled={submitting}
							onClick={() => void startDictation()}
							size="icon"
							style={{ borderRadius: "50%", height: "34px", width: "34px" }}
							type="button"
							variant="ghost"
						>
							<Mic size={17} />
						</Button>
						{showStop ? (
							<Button
								aria-label="Stop generation"
								disabled={stopping}
								onClick={() => void handleStop()}
								size="icon"
								style={{ borderRadius: "50%", height: "34px", width: "34px" }}
								type="button"
							>
								{stopping ? (
									<Loader2 className="animate-spin" size={13} />
								) : (
									<Square fill="currentColor" size={11} />
								)}
							</Button>
						) : (
							<Button
								aria-label="Send"
								disabled={sendDisabled}
								onClick={() => void handleSend()}
								size="icon"
								style={{ borderRadius: "50%", height: "34px", width: "34px" }}
								type="button"
							>
								{submitting ? (
									<Loader2 className="animate-spin" size={13} />
								) : (
									<ArrowUp size={13} />
								)}
							</Button>
						)}
					</>
				)}
			</div>
			{displayError && (
				<p className="type-extrasmall" style={{ color: "var(--danger)", margin: "6px 2px 0" }}>
					{displayError}
				</p>
			)}
		</fieldset>
	);
}
