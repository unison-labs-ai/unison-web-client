"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AgentToolApprovalDecisionRequest,
	AppEvent,
	Session,
	ThreadMessage,
	ThreadMessageListResponse,
	ThreadMessageSendResponse,
	ThreadMessageStreamEvent,
} from "@unison/contracts";
import { threadMessageSchema, threadMessageStreamEventSchema } from "@unison/contracts";
import { Files, Loader2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useApi } from "@/lib/api-context";
import { sessionIdFor, useAppEvents } from "@/lib/app-events-provider";
import { buildTranscriptTurns, mergeThreadMessages } from "@/lib/session-transcript";
import { mergeStreamEventRecord, type StreamEventRecord } from "@/lib/stream-events";
import {
	THREAD_MESSAGES_STALE_TIME,
	THREAD_STALE_TIME,
	threadMessagesQueryKey,
	threadQueryKey,
} from "@/lib/thread-cache";
import { ApprovalCard } from "@/ui/approval-card";
import { Breadcrumb } from "@/ui/breadcrumb";
import { Button } from "@/ui/button";
import { clearFirstTurn, peekFirstTurn } from "./first-turn-handoff";
import { ModulePanel } from "./modules/module-panel";
import { ModulesProvider, OVERVIEW_MODULE_ID, useModules } from "./modules/modules-context";
import { SessionComposer } from "./session-composer";
import { SessionViewSkeleton, TranscriptSkeleton } from "./session-skeleton";
import { noticeFromStreamEvent, Transcript, type TurnNotice } from "./transcript";

const TITLE_PENDING_REFETCH_MS = 1_500;

/** The agent-run id of the in-flight turn, or null when no turn is live.
 * Derived the way mobile does it: from the send 202 (`session.id`) and from a
 * snapshot assistant message with status "streaming" (`message.sessionId`). */
function liveTurnIdFromMessages(messages: ThreadMessage[]): string | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (
			message &&
			message.role === "assistant" &&
			message.status === "streaming" &&
			message.sessionId
		) {
			return message.sessionId;
		}
	}
	return null;
}

function recordValue(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
	const value = payload[key];
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function appEventMessage(event: AppEvent): ThreadMessage | null {
	const parsed = threadMessageSchema.safeParse(event.payload.message);
	return parsed.success ? parsed.data : null;
}

function hasPendingTitleGeneration(session: Session): boolean {
	const titleGeneration = recordValue(recordValue(session.metadata).titleGeneration);
	return titleGeneration.status === "pending";
}

class StaleThreadMessagesLoadError extends Error {}

function streamEventFromAppEvent(event: AppEvent): ThreadMessageStreamEvent | null {
	const parsed = threadMessageStreamEventSchema.safeParse(event.payload);
	return parsed.success ? parsed.data : null;
}

// The header's single right-side action: open this session's artifacts overview
// (email drafts, documents, the recording transcript) in the module panel.
// Rendered inside ModulesProvider so it can drive the panel.
function ArtifactsButton() {
	const { focusModule } = useModules();

	return (
		<Button
			aria-label="Artifacts"
			className="ml-auto shrink-0 gap-1.5"
			onClick={() => focusModule(OVERVIEW_MODULE_ID)}
			size="sm"
			variant="secondary"
		>
			<Files size={14} />
			Artifacts
		</Button>
	);
}

// ---------------------------------------------------------------------------
// Session view inner (has session data)
// ---------------------------------------------------------------------------

function SessionViewInner({ session }: { session: Session }) {
	const api = useApi();
	const appEvents = useAppEvents();
	const queryClient = useQueryClient();
	const bottomRef = useRef<HTMLDivElement>(null);
	const processedAppEventSeqByThreadRef = useRef<Record<string, number>>({});

	// First-turn handoff: when the home composer just created this thread, its
	// send 202 already carries the full initial snapshot (user message +
	// assistant placeholder + run id). Seed from it so the session renders
	// instantly; the live stream replays the turn from event 0.
	const [handoff] = useState(() => peekFirstTurn(session.id));
	// Otherwise seed from the snapshot cache (hover prefetch / recent visit) so
	// a warm open paints the transcript on the very first frame instead of
	// flashing the loading bones.
	const [seededMessages] = useState(() =>
		handoff
			? undefined
			: queryClient.getQueryData<ThreadMessageListResponse>(threadMessagesQueryKey(session.id)),
	);

	// Durable messages + the live turn's stream records, folded into ordered
	// turns the way mobile does it: messages carry history, records carry the
	// in-flight turn's chronological text/tool parts + the ephemeral activity
	// line — and keep tool cards visible after the durable refresh.
	const [messages, setMessagesState] = useState<ThreadMessage[]>(() =>
		handoff ? [handoff.userMessage, handoff.assistantMessage] : (seededMessages?.messages ?? []),
	);
	const messagesRef = useRef(messages);
	const [records, setRecords] = useState<StreamEventRecord[]>([]);
	// Abnormal turn endings, set on terminal events and cleared by the next send.
	const [notice, setNotice] = useState<TurnNotice | null>(null);
	// False only while the snapshot has never been seen — the transcript column
	// shows message bones then, never a false "No messages yet.".
	const [messagesReady, setMessagesReady] = useState(Boolean(handoff) || Boolean(seededMessages));
	const [messagesError, setMessagesError] = useState(false);
	// The agent-run id of the in-flight turn. Used for targeted stop/approval state;
	// live transcript updates come from the app-wide event stream.
	const [liveTurnId, setLiveTurnId] = useState<string | null>(() =>
		handoff
			? handoff.session.id
			: seededMessages
				? liveTurnIdFromMessages(seededMessages.messages)
				: null,
	);
	const turns = useMemo(() => buildTranscriptTurns(messages, records), [messages, records]);
	const streaming = turns.some((turn) => turn.activity.streaming);
	const isLive = streaming || liveTurnId !== null;

	// Load initial messages through the query cache: a hover-prefetched or
	// recently-visited session resolves from memory (deduped with the prefetch),
	// a cold one fetches. `fresh` bypasses staleness for post-turn refreshes. A
	// stale guard drops responses that resolve after a newer load started
	// (back-navigation races).
	const loadSeqRef = useRef(0);
	const mergeMessages = useCallback((incoming: ThreadMessage[]) => {
		const nextMessages = mergeThreadMessages(messagesRef.current, incoming);
		messagesRef.current = nextMessages;
		setMessagesState(nextMessages);
		return nextMessages;
	}, []);
	const loadMessages = useCallback(
		(opts?: { fresh?: boolean }) => {
			const loadSeq = ++loadSeqRef.current;
			setMessagesError(false);
			queryClient
				.fetchQuery({
					queryFn: async () => {
						const res = await api.listThreadMessages(session.id);
						if (loadSeq !== loadSeqRef.current) {
							throw new StaleThreadMessagesLoadError();
						}
						return res;
					},
					queryKey: threadMessagesQueryKey(session.id),
					retry: (failureCount, loadError) =>
						!(loadError instanceof StaleThreadMessagesLoadError) && failureCount < 3,
					staleTime: opts?.fresh ? 0 : THREAD_MESSAGES_STALE_TIME,
				})
				.then((res) => {
					if (loadSeq !== loadSeqRef.current) return;
					// The durable snapshot updates known rows, but messages are
					// append-only: preserve a locally accepted queued turn if an older
					// terminal refresh resolves late.
					clearFirstTurn(session.id);
					const nextMessages = mergeMessages(res.messages);
					setMessagesReady(true);
					setLiveTurnId(liveTurnIdFromMessages(nextMessages));
					queryClient.setQueryData<ThreadMessageListResponse>(threadMessagesQueryKey(session.id), {
						...res,
						messages: nextMessages,
					});
				})
				.catch((loadError) => {
					if (loadSeq !== loadSeqRef.current || loadError instanceof StaleThreadMessagesLoadError) {
						return;
					}
					setMessagesError(true);
				});
		},
		[api, mergeMessages, queryClient, session.id],
	);

	useEffect(() => {
		// The handoff seeded the full initial snapshot — fetching it again would
		// race the live stream (INIT mid-replay drops accumulated deltas).
		if (handoff) return;
		loadMessages();
	}, [handoff, loadMessages]);

	// Past turns' tool cards (and the modules they open) live only in the durable
	// event log, never in the text-only messages — so a reloaded session would
	// drop them. Seed the records the transcript is built from with the coalesced
	// history; the live stream still owns the in-flight turn (excluded server-side,
	// so its records never collide with these on re-key by run id).
	useEffect(() => {
		if (handoff) return;
		let cancelled = false;
		api
			.listThreadEvents(session.id)
			.then((res) => {
				if (cancelled || res.events.length === 0) return;
				const receivedAt = new Date().toISOString();
				setRecords((prev) =>
					res.events.reduce(
						(records, event) => mergeStreamEventRecord(records, { event, receivedAt }),
						prev,
					),
				);
			})
			.catch(() => {
				// Best-effort: a failed history fetch falls back to text-only past turns.
			});
		return () => {
			cancelled = true;
		};
	}, [api, handoff, session.id]);

	// Streaming events. On a terminal event the turn is over: refresh the durable
	// snapshot, and let the lists know (api-usage.md §4).
	const onEvent = useCallback(
		(event: ThreadMessageStreamEvent) => {
			// Fold every wire event into the records the turn model is built from;
			// merge dedupes re-deliveries by (type, index) so replays are idempotent.
			setRecords((prev) =>
				mergeStreamEventRecord(prev, { event, receivedAt: new Date().toISOString() }),
			);
			if (event.type === "message.completed") {
				mergeMessages([event.message]);
			}
			if (event.type === "input.requested") {
				void queryClient.invalidateQueries({ queryKey: ["approvals"] });
			}
			if (event.type === "session.completed" || event.type === "error") {
				setNotice(noticeFromStreamEvent(event));
				setLiveTurnId(null);
				// The turn just changed the durable snapshot — a cached copy is stale
				// by definition here.
				loadMessages({ fresh: true });
				void queryClient.invalidateQueries({ queryKey: ["threads"] });
				void queryClient.invalidateQueries({ queryKey: ["thread", session.id] });
			}
		},
		[loadMessages, mergeMessages, queryClient, session.id],
	);

	const applyAppEvent = useCallback(
		(event: AppEvent) => {
			const streamEvent = streamEventFromAppEvent(event);

			if (streamEvent) {
				onEvent(streamEvent);
				return;
			}

			if (event.type === "turn.admitted" || event.type === "run.started") {
				setNotice(null);
				setLiveTurnId(
					payloadString(event.payload, "sessionId") ?? payloadString(event.payload, "runId"),
				);
				return;
			}

			if (event.type === "message.created") {
				const message = appEventMessage(event);

				if (!message) {
					return;
				}

				mergeMessages([message]);
				setMessagesReady(true);

				if (message.sessionId) {
					setLiveTurnId(message.sessionId);
				}
			}
		},
		[mergeMessages, onEvent],
	);

	useEffect(() => {
		const lastProcessed = processedAppEventSeqByThreadRef.current[session.id] ?? 0;
		const relevantEvents = appEvents.events
			.filter((event) => event.seq > lastProcessed && sessionIdFor(event) === session.id)
			.sort((left, right) => left.seq - right.seq);

		let nextProcessedSeq = lastProcessed;

		for (const event of relevantEvents) {
			nextProcessedSeq = Math.max(nextProcessedSeq, event.seq);
			applyAppEvent(event);
		}

		processedAppEventSeqByThreadRef.current[session.id] = nextProcessedSeq;
	}, [appEvents.events, applyAppEvent, session.id]);

	// After a send, the 202 carries both messages and the new turn's run id.
	const handleSendResponse = useCallback(
		async (res: ThreadMessageSendResponse) => {
			loadSeqRef.current += 1;
			await queryClient.cancelQueries({
				exact: true,
				queryKey: threadMessagesQueryKey(session.id),
			});

			setNotice(null);
			const nextMessages = mergeMessages([res.userMessage, res.assistantMessage]);
			setMessagesReady(true);
			// Keep the snapshot cache in step so a quick back-and-forth doesn't
			// resurrect a pre-send message list.
			queryClient.setQueryData<ThreadMessageListResponse>(threadMessagesQueryKey(session.id), {
				messages: nextMessages,
				thread: res.thread,
			});
			setLiveTurnId(res.session.id);
		},
		[mergeMessages, queryClient, session.id],
	);

	// present_options: tapping an option (e.g. Run now / Not now) sends its label
	// back as the user's next message — the same send path the composer uses.
	const handleSelectOption = useCallback(
		async (text: string) => {
			const content = text.trim();
			if (!content) {
				return;
			}
			const response = await api.sendThreadMessage(session.id, {
				attachments: [],
				clientMessageId: crypto.randomUUID(),
				content,
				permissionMode: session.permissionMode,
			});
			await handleSendResponse(response);
		},
		[api, handleSendResponse, session.id, session.permissionMode],
	);

	// Pending approvals for this session — rendered inline where the turn
	// paused (screens.md §3/§6). Poll lightly while the turn is live.
	// Approvals carry the agent-run id as `sessionId`; the thread id lives in
	// metadata.threadId (engine behavior), with the run-id set as fallback.
	const { data: approvalsData } = useQuery({
		queryFn: () => api.listPendingApprovals(),
		queryKey: ["approvals", "pending"],
		refetchInterval: isLive ? 8_000 : false,
		staleTime: 5_000,
	});
	const sessionRunIds = useMemo(() => {
		const ids = new Set<string>();
		for (const message of messages) {
			if (message.sessionId) ids.add(message.sessionId);
		}
		if (liveTurnId) ids.add(liveTurnId);
		return ids;
	}, [messages, liveTurnId]);
	const pendingApprovals = (approvalsData ?? []).filter(
		(approval) =>
			approval.status === "pending" &&
			(approval.metadata.threadId === session.id || sessionRunIds.has(approval.sessionId)),
	);

	const decideMutation = useMutation({
		mutationFn: ({
			approvalId,
			request,
		}: {
			approvalId: string;
			request: AgentToolApprovalDecisionRequest;
		}) => api.decideApproval(approvalId, request),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["approvals"] });
		},
	});

	// Auto-scroll: the first contentful render positions to the bottom before
	// paint (a smooth scroll here sweeps visibly through the whole transcript on
	// open); after that, follow the stream smoothly — and only while the reader
	// is pinned near the bottom, never while they read history.
	const scrollRef = useRef<HTMLDivElement>(null);
	const pinnedRef = useRef(true);
	const hasPositionedRef = useRef(false);
	const onScroll = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
	}, []);
	useLayoutEffect(() => {
		if (turns.length === 0) return;
		if (!hasPositionedRef.current) {
			hasPositionedRef.current = true;
			const el = scrollRef.current;
			if (el) el.scrollTop = el.scrollHeight;
			return;
		}
		if (pinnedRef.current) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [turns]);

	return (
		<ModulesProvider captureId={session.captureId} captureTitle={session.title} turns={turns}>
			<div className="flex h-full min-h-0">
				{/* Chat column — shrinks instantly as the module panel grows (no transition). */}
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					{/* Header */}
					<div className="flex min-h-12 shrink-0 items-center gap-2 px-4 md:min-h-14 md:pr-[var(--app-top-actions-reserve)]">
						<Breadcrumb
							items={[
								{ href: "/sessions", label: "Sessions" },
								{ label: session.title ?? "Untitled session" },
							]}
						/>

						{isLive && (
							<Loader2
								className="animate-spin"
								size={13}
								style={{ color: "var(--sky-foreground)", flexShrink: 0 }}
							/>
						)}

						<ArtifactsButton />
					</div>

					{/* Transcript canvas — readable column with a real composer dock. */}
					<div
						style={{
							display: "flex",
							flex: 1,
							flexDirection: "column",
							minHeight: 0,
							position: "relative",
						}}
					>
						<div
							onScroll={onScroll}
							ref={scrollRef}
							style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}
						>
							<div
								style={{
									animation: "fade-up 220ms ease-out",
									margin: "0 auto",
									maxWidth: "768px",
									width: "100%",
								}}
							>
								{messagesError ? (
									<div
										style={{
											alignItems: "center",
											display: "flex",
											flexDirection: "column",
											gap: "10px",
											padding: "40px 0",
										}}
									>
										<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
											Failed to load messages.
										</p>
										<Button onClick={() => loadMessages()} variant="secondary">
											Retry
										</Button>
									</div>
								) : messagesReady ? (
									<Transcript onSelectOption={handleSelectOption} turns={turns} />
								) : (
									<TranscriptSkeleton />
								)}

								{/* Abnormal turn endings (screens.md §3: failures must not look benign) */}
								{notice && (
									<p
										className="type-small"
										style={{
											color: notice.kind === "cancelled" ? "var(--ink-subtle)" : "var(--danger)",
											margin: "4px 0 8px",
										}}
									>
										{notice.kind === "cancelled"
											? "Stopped."
											: notice.kind === "failed"
												? "The turn failed. Send a message to retry."
												: `The turn failed: ${notice.message ?? "unknown error"}`}
									</p>
								)}

								{/* Approval cards inline where the turn paused (screens.md §3) */}
								{pendingApprovals.length > 0 && (
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "8px",
											padding: "8px 0 16px",
										}}
									>
										{pendingApprovals.map((approval) => (
											<ApprovalCard
												approval={approval}
												key={approval.id}
												onDecide={(request) =>
													decideMutation.mutate({ approvalId: approval.id, request })
												}
											/>
										))}
										{decideMutation.isError && (
											<p className="type-extrasmall" style={{ color: "var(--danger)", margin: 0 }}>
												Failed to submit decision. Try again.
											</p>
										)}
									</div>
								)}
								<div ref={bottomRef} />
							</div>
						</div>

						{/* Composer dock — background fills the full bottom band, while the
						    input itself keeps the layer-1 rounded panel treatment. */}
						<div
							style={{
								background: "var(--background)",
								display: "flex",
								justifyContent: "center",
								padding: "0 16px max(14px, env(safe-area-inset-bottom))",
								position: "relative",
								zIndex: 1,
							}}
						>
							<div style={{ maxWidth: "768px", width: "100%" }}>
								<SessionComposer
									isStreaming={isLive}
									liveTurnId={liveTurnId}
									onResponse={handleSendResponse}
									permissionMode={session.permissionMode}
									threadId={session.id}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Module panel — in-flow sibling (resizer + pane); absent until an
				    artifact opens. Built from scratch so resize is instant (§6.8). */}
				<ModulePanel />
			</div>
		</ModulesProvider>
	);
}

// ---------------------------------------------------------------------------
// Public component — loads the session then renders
// ---------------------------------------------------------------------------

type SessionViewProps = {
	sessionId: string;
};

export function SessionView({ sessionId }: SessionViewProps) {
	const api = useApi();

	const { data, isError, isLoading, refetch } = useQuery({
		queryFn: () => api.getThread(sessionId),
		queryKey: threadQueryKey(sessionId),
		staleTime: THREAD_STALE_TIME,
	});

	useEffect(() => {
		if (!data?.thread || !hasPendingTitleGeneration(data.thread)) {
			return;
		}

		const timer = setTimeout(() => {
			void refetch();
		}, TITLE_PENDING_REFETCH_MS);

		return () => {
			clearTimeout(timer);
		};
	}, [data?.thread, refetch]);

	// Same bones as the route's loading.tsx — a cold thread fetch continues the
	// exact frame the navigation painted, instead of swapping layouts.
	if (isLoading) return <SessionViewSkeleton />;

	if (isError || !data) {
		return (
			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
					justifyContent: "center",
					padding: "40px 16px",
				}}
			>
				<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
					Failed to load session.
				</p>
				<Button onClick={() => void refetch()} variant="secondary">
					Retry
				</Button>
			</div>
		);
	}

	// Keyed by session id: route param changes must never reuse another
	// session's reducer state or stream cursor.
	return <SessionViewInner key={data.thread.id} session={data.thread} />;
}
