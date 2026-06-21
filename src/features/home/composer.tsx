"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatPermissionMode, Session } from "@unison/contracts";
import { ArrowUp, ImagePlus, Loader2, Mic, Plus, Square, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AttachmentStrip } from "@/features/composer/attachment-strip";
import {
	ChipInput,
	type ChipInputHandle,
	type ChipInputSeedPart,
} from "@/features/composer/chip-input";
import { DictationWaveform, formatElapsed } from "@/features/composer/dictation-visuals";
import { PermissionModeControl } from "@/features/composer/permission-mode-control";
import { AUTOMATION_CHIP, buildSlashCommands } from "@/features/composer/slash-commands";
import { useDictationControls } from "@/features/composer/use-dictation-controls";
import { useImageAttachments } from "@/features/composer/use-image-attachments";
import { useRealtimeTranscription } from "@/features/composer/use-realtime-transcription";
import { stashFirstTurn } from "@/features/sessions/first-turn-handoff";
import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { cn } from "@/ui/utils";

type ComposerProps = {
	onChange: (v: string) => void;
	value: string;
	/** Seed the input once on mount (e.g. /automations/new pre-fills the
	 * automation prompt). Takes precedence over the ?compose= query flow. */
	seed?: ChipInputSeedPart[];
};

/**
 * Cross-page composer seed handoff (module slot, mirrors first-turn-handoff).
 * In-app entry points ("Edit with assistant" on an automation) stash parts
 * here before pushing "/" — reading window.location in the mount effect is
 * racy during client navigations (Next commits the page before the URL).
 */
let stashedSeed: ChipInputSeedPart[] | null = null;

export function stashComposerSeed(parts: ChipInputSeedPart[]): void {
	stashedSeed = parts;
}

/** The "Create an [automation] that …" prompt seeded into the composer by
 * automation entry points (home's ?compose=automation and /automations/new). */
export function automationSeedParts(template: string | null): ChipInputSeedPart[] {
	return template
		? [
				{ text: "Create an " },
				{ chip: AUTOMATION_CHIP },
				{ text: ` from the "${template}" template ` },
			]
		: [{ text: "Create an " }, { chip: AUTOMATION_CHIP }, { text: " that " }];
}

export function Composer({ value, onChange, seed }: ComposerProps) {
	const api = useApi();
	const queryClient = useQueryClient();
	const router = useRouter();
	const draftThreadRef = useRef<Session | null>(null);
	const imageInputRef = useRef<HTMLInputElement | null>(null);
	const chipInputRef = useRef<ChipInputHandle | null>(null);
	const seededRef = useRef(false);
	const [submitting, setSubmitting] = useState(false);
	const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
	const [draftThread, setDraftThread] = useState<Session | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [localPermissionMode, setLocalPermissionMode] = useState<ChatPermissionMode | null>(null);
	const transcription = useRealtimeTranscription();

	// The slash menu lists the user's automations as mention chips — share the
	// list page's cache identity so this also warms /automations.
	const automationsQuery = useQuery({
		queryFn: () => api.listAutomations(),
		queryKey: ["automations"],
		staleTime: 30_000,
	});
	const slashCommands = useMemo(
		() => buildSlashCommands(automationsQuery.data ?? []),
		[automationsQuery.data],
	);
	const accountPolicyQuery = useQuery({
		queryFn: () => api.getAgentAccountPolicy(),
		queryKey: ["agent-account-policy"],
		staleTime: 30_000,
	});
	const updatePolicyMutation = useMutation({
		mutationFn: (mode: ChatPermissionMode) =>
			api.updateAgentAccountPolicy({ lastChatPermissionMode: mode }),
		onSuccess: (response) => {
			queryClient.setQueryData(["agent-account-policy"], response);
		},
	});
	const updateThreadModeMutation = useMutation({
		mutationFn: ({ mode, threadId }: { mode: ChatPermissionMode; threadId: string }) =>
			api.updateThreadPermissionMode(threadId, { permissionMode: mode }),
	});
	const permissionMode =
		localPermissionMode ??
		accountPolicyQuery.data?.policy.lastChatPermissionMode ??
		accountPolicyQuery.data?.policy.chatDefaultMode ??
		"ask";
	const dictating =
		transcription.state === "recording" ||
		transcription.state === "starting" ||
		transcription.state === "stopping";
	const dictationBusy = transcription.state === "starting" || transcription.state === "stopping";

	// Seed the input once on mount. A surface can pass `seed` directly
	// (/automations/new); otherwise entry points elsewhere in the app land on
	// /?compose=automation — seed the chip prompt, then clean the URL. Reads
	// window.location so the page needs no Suspense boundary for
	// useSearchParams.
	useEffect(() => {
		if (seededRef.current) return;
		seededRef.current = true;
		if (seed) {
			if (seed.length > 0) chipInputRef.current?.seed(seed);
			return;
		}
		if (stashedSeed) {
			const parts = stashedSeed;
			stashedSeed = null;
			if (parts.length > 0) chipInputRef.current?.seed(parts);
			return;
		}
		const params = new URLSearchParams(window.location.search);
		if (params.get("compose") !== "automation") return;
		chipInputRef.current?.seed(automationSeedParts(params.get("template")));
		router.replace("/", { scroll: false });
	}, [router, seed]);

	const ensureDraftThread = useCallback(
		async (draftTitle: string) => {
			if (draftThreadRef.current) {
				return draftThreadRef.current;
			}

			const created = await api.createThread({
				metadata: {},
				permissionMode,
				title: draftTitle.slice(0, 80) || "Photo",
				type: "freeform",
			});

			draftThreadRef.current = created.thread;
			setDraftThread(created.thread);

			return created.thread;
		},
		[api, permissionMode],
	);

	function changePermissionMode(mode: ChatPermissionMode) {
		setLocalPermissionMode(mode);
		if (draftThreadRef.current) {
			void updateThreadModeMutation.mutateAsync({ mode, threadId: draftThreadRef.current.id });
		} else {
			void updatePolicyMutation.mutateAsync(mode);
		}
	}

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
		ensureThread: ensureDraftThread,
		getDraftTitle: () => value,
		onError: setError,
	});

	async function submit(explicitValue?: string) {
		const text = (explicitValue ?? value).trim();
		if (submitting || hasPendingAttachments || (!text && attachmentPayload.length === 0)) return;
		setSubmitting(true);
		setError(null);
		try {
			const request = { attachments: attachmentPayload, content: text, permissionMode };
			const targetThread = draftThreadRef.current ?? draftThread;
			const res = targetThread
				? await api.sendThreadMessage(targetThread.id, request)
				: await api.admitThreadMessage(request);

			// Hand the 202 to the session view so it renders the first turn
			// instantly instead of refetching the thread + messages through
			// skeletons after navigation.
			stashFirstTurn(res);
			queryClient.setQueryData(["thread", res.thread.id], { thread: res.thread });

			chipInputRef.current?.clear();
			clearAttachments();
			draftThreadRef.current = null;
			setDraftThread(null);
			router.push(`/sessions/${res.thread.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setSubmitting(false);
		}
	}

	const { cancelDictation, sendDictation, startDictation, stopDictation } = useDictationControls({
		appendTranscript: (transcript) => chipInputRef.current?.appendText(transcript) ?? value,
		canStart: () => !submitting && !dictating,
		focusInput: () => chipInputRef.current?.focus(),
		setError,
		submit,
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

	return (
		<fieldset
			aria-label="Message composer"
			className={cn(
				"m-0 min-w-0 rounded-lg border border-(--border) bg-surface-muted",
				"hover:border-[rgba(251,252,252,0.16)] focus-within:border-[rgba(251,252,252,0.16)]",
			)}
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
				onChange={onChange}
				onSubmit={() => void submit()}
				placeholder="Ask anything, start a task…"
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
									<DropdownMenuItem
										className="text-ink hover:bg-primary-soft hover:text-ink data-[highlighted]:bg-primary-soft data-[highlighted]:text-ink"
										onSelect={() => {
											setAttachmentMenuOpen(false);
											chipInputRef.current?.appendChip(AUTOMATION_CHIP);
										}}
									>
										<Zap size={16} />
										New automation
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
							disabled={submitting}
							mode={permissionMode}
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
						<Button
							aria-label="Send"
							disabled={sendDisabled}
							onClick={() => void submit()}
							size="icon"
							style={{ borderRadius: "50%", height: "34px", width: "34px" }}
							type="button"
						>
							{submitting ? <Loader2 className="animate-spin" size={14} /> : <ArrowUp size={14} />}
						</Button>
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
