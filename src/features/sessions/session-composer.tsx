"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	ChatPermissionMode,
	ThreadMessageCreateRequest,
	ThreadMessageSendResponse,
} from "@unison/contracts";
import { ArrowUp, ImagePlus, Loader2, Mic, Pencil, Plus, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AttachmentStrip } from "@/features/composer/attachment-strip";
import type { ChatAttachmentDraft } from "@/features/composer/attachments";
import { ChipInput, type ChipInputHandle } from "@/features/composer/chip-input";
import { DictationWaveform, formatElapsed } from "@/features/composer/dictation-visuals";
import { PermissionModeControl } from "@/features/composer/permission-mode-control";
import { buildSlashCommands } from "@/features/composer/slash-commands";
import { useDictationControls } from "@/features/composer/use-dictation-controls";
import { useImageAttachments } from "@/features/composer/use-image-attachments";
import { useRealtimeTranscription } from "@/features/composer/use-realtime-transcription";
import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { threadQueryKey } from "@/lib/thread-cache";
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
	onResponse?: (response: ThreadMessageSendResponse) => Promise<void> | void;
	permissionMode: ChatPermissionMode;
	threadId: string;
};

const MAX_QUEUED_MESSAGES = 5;
const THREAD_BUSY_RETRY_MS = 2500;

type QueuedComposerMessage = {
	attachments: ChatAttachmentDraft[];
	error?: string | null;
	id: string;
	request: ThreadMessageCreateRequest;
};

export function SessionComposer({
	isStreaming,
	liveTurnId,
	onResponse,
	permissionMode,
	threadId,
}: SessionComposerProps) {
	const api = useApi();
	const queryClient = useQueryClient();
	const imageInputRef = useRef<HTMLInputElement | null>(null);
	const chipInputRef = useRef<ChipInputHandle | null>(null);
	const [value, setValue] = useState("");
	const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [stopping, setStopping] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [localPermissionMode, setLocalPermissionMode] = useState<ChatPermissionMode | null>(null);
	const [queuedMessages, setQueuedMessages] = useState<QueuedComposerMessage[]>([]);
	const [queueSendingId, setQueueSendingId] = useState<string | null>(null);
	const [queueRetryTick, setQueueRetryTick] = useState(0);
	const queueRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const activeThreadIdRef = useRef(threadId);
	const queuedMessagesRef = useRef<QueuedComposerMessage[]>([]);
	const queueSendingRef = useRef(false);
	const mountedRef = useRef(false);
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
	const effectivePermissionMode = localPermissionMode ?? permissionMode;
	const updateThreadModeMutation = useMutation({
		mutationFn: (mode: ChatPermissionMode) =>
			api.updateThreadPermissionMode(threadId, { permissionMode: mode }),
		onSuccess: (response) => {
			queryClient.setQueryData(threadQueryKey(threadId), response);
		},
	});

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
		discardAttachments,
		hasPendingAttachments,
		releaseAttachments,
		removeAttachment,
		replaceAttachments,
	} = useImageAttachments({
		disabled: submitting,
		ensureThread: ensureUploadThread,
		getDraftTitle: () => value,
		onError: setError,
	});

	useEffect(() => {
		queuedMessagesRef.current = queuedMessages;
	}, [queuedMessages]);

	useEffect(() => {
		mountedRef.current = true;

		return () => {
			mountedRef.current = false;
			queueSendingRef.current = false;
			if (queueRetryTimerRef.current) {
				clearTimeout(queueRetryTimerRef.current);
			}
			for (const message of queuedMessagesRef.current) {
				discardAttachments(message.attachments);
			}
		};
	}, [discardAttachments]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset the local queue whenever this composer is bound to a different thread.
	useEffect(() => {
		activeThreadIdRef.current = threadId;
		queueSendingRef.current = false;
		setQueueSendingId(null);
		setQueuedMessages((current) => {
			for (const message of current) {
				discardAttachments(message.attachments);
			}
			return [];
		});

		if (queueRetryTimerRef.current) {
			clearTimeout(queueRetryTimerRef.current);
			queueRetryTimerRef.current = null;
		}
	}, [threadId]);

	const sendRequest = useCallback(
		async (
			request: ThreadMessageCreateRequest,
			options: { shouldApply?: () => boolean } = {},
		): Promise<ThreadMessageSendResponse | null> => {
			const response = await api.sendThreadMessage(threadId, request);

			if (options.shouldApply?.() === false) {
				return null;
			}

			await onResponse?.(response);
			return response;
		},
		[api, onResponse, threadId],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: FIFO flush is keyed on queue/live state; helpers only touch stable refs and setters.
	useEffect(() => {
		if (isStreaming) {
			return;
		}

		const next = queuedMessages[0];
		if (
			!next ||
			next.error ||
			submitting ||
			queueSendingRef.current ||
			queueRetryTimerRef.current
		) {
			return;
		}

		const nextMessage = next;
		const flushThreadId = threadId;

		async function flushQueuedMessage() {
			queueSendingRef.current = true;
			setQueueSendingId(nextMessage.id);
			setError(null);

			try {
				const response = await sendRequest(nextMessage.request, {
					shouldApply: () => mountedRef.current && activeThreadIdRef.current === flushThreadId,
				});

				if (!response || !mountedRef.current || activeThreadIdRef.current !== flushThreadId) {
					return;
				}

				releaseAttachments(nextMessage.attachments);
				setQueuedMessages((current) =>
					current[0]?.id === nextMessage.id
						? current.slice(1)
						: current.filter((message) => message.id !== nextMessage.id),
				);
			} catch (flushError) {
				if (!mountedRef.current || activeThreadIdRef.current !== flushThreadId) {
					return;
				}

				if (isThreadBusyError(flushError)) {
					scheduleQueueRetry();
					return;
				}

				setQueuedMessages((current) =>
					current.map((message) =>
						message.id === nextMessage.id
							? {
									...message,
									error:
										flushError instanceof Error
											? flushError.message
											: "Failed to send queued message.",
								}
							: message,
					),
				);
			} finally {
				if (mountedRef.current && activeThreadIdRef.current === flushThreadId) {
					queueSendingRef.current = false;
					setQueueSendingId(null);
				}
			}
		}

		void flushQueuedMessage();
	}, [
		isStreaming,
		queueRetryTick,
		queuedMessages,
		releaseAttachments,
		sendRequest,
		submitting,
		threadId,
	]);

	function scheduleQueueRetry() {
		if (queueRetryTimerRef.current) {
			return;
		}

		queueRetryTimerRef.current = setTimeout(() => {
			queueRetryTimerRef.current = null;
			if (!mountedRef.current) {
				return;
			}
			setQueueRetryTick((tick) => tick + 1);
		}, THREAD_BUSY_RETRY_MS);
	}

	function enqueueRequest(request: ThreadMessageCreateRequest): boolean {
		if (queuedMessages.length >= MAX_QUEUED_MESSAGES) {
			setError(`You can queue up to ${MAX_QUEUED_MESSAGES} messages.`);
			return false;
		}

		setQueuedMessages((current) =>
			current.length >= MAX_QUEUED_MESSAGES
				? current
				: [
						...current,
						{
							attachments: attachments.map((attachment) => ({ ...attachment })),
							id: createClientMessageId(),
							request,
						},
					],
		);
		setError(null);
		return true;
	}

	function clearDraft(options: { revokeAttachments?: boolean } = {}) {
		chipInputRef.current?.clear();
		setValue("");
		clearAttachments({ revokePreviewUrls: options.revokeAttachments ?? true });
	}

	async function handleSend(explicitValue?: string) {
		const text = (explicitValue ?? value).trim();
		// "Respond while it works" — the composer stays live mid-turn (screens.md §3).
		if (submitting || hasPendingAttachments || (!text && attachmentPayload.length === 0)) return;
		const request: ThreadMessageCreateRequest = {
			attachments: attachmentPayload,
			clientMessageId: createClientMessageId(),
			content: text,
			permissionMode: effectivePermissionMode,
		};

		if (isStreaming || queueSendingRef.current || queuedMessages.length > 0) {
			if (enqueueRequest(request)) {
				clearDraft({ revokeAttachments: false });
			}
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			await sendRequest(request);
			clearDraft();
		} catch (err) {
			if (isThreadBusyError(err) && enqueueRequest(request)) {
				clearDraft({ revokeAttachments: false });
				return;
			}

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

	function isQueuedMessageLocked(id: string): boolean {
		return queueSendingRef.current && queuedMessagesRef.current[0]?.id === id;
	}

	function removeQueuedMessage(id: string) {
		if (isQueuedMessageLocked(id)) {
			return;
		}

		setQueuedMessages((current) => {
			const target = current.find((message) => message.id === id);

			if (target) {
				discardAttachments(target.attachments);
			}

			return current.filter((message) => message.id !== id);
		});
	}

	function editQueuedMessage(message: QueuedComposerMessage) {
		if (isQueuedMessageLocked(message.id)) {
			return;
		}

		setQueuedMessages((current) => current.filter((queued) => queued.id !== message.id));
		setValue(message.request.content);
		replaceAttachments(message.attachments);
		setError(null);
		requestAnimationFrame(() => chipInputRef.current?.focus());
	}

	const displayError = error ?? transcription.error;
	function changePermissionMode(mode: ChatPermissionMode) {
		setLocalPermissionMode(mode);
		updateThreadModeMutation.mutate(mode, {
			onError: (modeError) => {
				setLocalPermissionMode(null);
				setError(modeError instanceof Error ? modeError.message : "Failed to update mode");
			},
		});
	}
	const sendDisabled =
		submitting || hasPendingAttachments || (!value.trim() && attachmentPayload.length === 0);
	// One trailing button: while a turn is live and there is nothing to send it
	// is Stop; the moment a draft exists it morphs back into Send ("respond
	// while it works", screens.md §3).
	const showStop = Boolean(isStreaming) && !submitting && !value.trim() && attachments.length === 0;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
			<QueuedMessageTray
				lockedId={queueSendingId}
				messages={queuedMessages}
				onEdit={editQueuedMessage}
				onRemove={removeQueuedMessage}
			/>
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
							<PermissionModeControl
								disabled={submitting || stopping}
								mode={effectivePermissionMode}
								onChange={changePermissionMode}
							/>
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
		</div>
	);
}

function QueuedMessageTray({
	lockedId,
	messages,
	onEdit,
	onRemove,
}: {
	lockedId?: string | null;
	messages: QueuedComposerMessage[];
	onEdit: (message: QueuedComposerMessage) => void;
	onRemove: (id: string) => void;
}) {
	if (messages.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col items-end gap-1 px-2">
			{messages.map((message) => {
				const label = queuedMessageLabel(message.request);
				const isLocked = lockedId === message.id;

				return (
					<div
						className={cn(
							"group flex max-w-[min(560px,92%)] items-start gap-2 rounded-lg border border-(--border) bg-surface-muted/80 px-3 py-2 text-ink-muted",
							message.error ? "border-danger" : "",
						)}
						key={message.id}
					>
						<div className="min-w-0 text-right">
							<p
								className="type-small"
								style={{
									display: "-webkit-box",
									margin: 0,
									overflow: "hidden",
									overflowWrap: "anywhere",
									WebkitBoxOrient: "vertical",
									WebkitLineClamp: 3,
									whiteSpace: "normal",
								}}
							>
								{label}
							</p>
							{message.error ? (
								<p
									className="type-extrasmall"
									style={{ color: "var(--danger)", margin: "3px 0 0" }}
								>
									{message.error}
								</p>
							) : null}
						</div>
						<div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
							<button
								aria-label="Edit queued message"
								className="grid h-6 w-6 place-items-center rounded-full text-ink-subtle hover:bg-primary-soft hover:text-ink disabled:opacity-50"
								disabled={isLocked}
								onClick={() => onEdit(message)}
								title="Edit queued message"
								type="button"
							>
								<Pencil size={13} />
							</button>
							<button
								aria-label="Remove queued message"
								className="grid h-6 w-6 place-items-center rounded-full text-ink-subtle hover:bg-primary-soft hover:text-ink disabled:opacity-50"
								disabled={isLocked}
								onClick={() => onRemove(message.id)}
								title="Remove queued message"
								type="button"
							>
								<X size={14} />
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function queuedMessageLabel(request: ThreadMessageCreateRequest): string {
	const content = request.content.trim();

	if (content) {
		return content;
	}

	if (request.attachments.length === 1) {
		return "Image attachment";
	}

	return `${request.attachments.length} image attachments`;
}

function createClientMessageId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isThreadBusyError(error: unknown): boolean {
	return error instanceof WebApiError && error.code === "thread_busy";
}
