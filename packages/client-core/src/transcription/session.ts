/** TranscriptionSession — the platform-independent realtime transcription
 * engine. Owns the provider socket lifecycle so the clients only own audio
 * capture and UI.
 *
 * Design (docs/plans/voice-transcription-refactor.md §3):
 *
 * - SEND PATH. Chunks are byte-accounted into recording-relative time
 *   (16kHz mono PCM16 → 32 bytes/ms) and retained in a rolling window. The
 *   send cursor walks the window; a connection drop rewinds it to just before
 *   the last committed point, so reconnects REPLAY the unacknowledged tail
 *   instead of silently dropping it. `previous_text` rides only on the first
 *   chunk of each connection (protocol requirement) as context seeding.
 * - DRAIN. stop() flushes the window, sends one commit, then waits until a
 *   committed event has answered the commit AND no transcript event has
 *   arrived for `drainQuiescenceMs` — not "first final or 1.5s" like the old
 *   clients, which truncated backlogged recordings. `insufficient_audio_
 *   activity` resolves immediately (nothing was pending); `drainCeilingMs`
 *   bounds the wait and marks the result incomplete.
 * - ROTATION. The provider enforces an (undocumented) session time limit.
 *   Before it can bite, the session gracefully commits + closes the current
 *   socket and opens a fresh one (new single-use token) — sequentially, so
 *   committed text never interleaves out of order. The brief pause is
 *   absorbed by the retention window and caught up after the swap.
 * - GAPS. Whenever audio provably never reached the provider (retention
 *   overflow while disconnected, drain ceiling), the span is recorded as a
 *   gap and the result is flagged incomplete so the capture layer can run a
 *   batch repair from the local safety cache.
 *
 * Everything is injected (token mint, socket factory, timers) so the test
 * suite can script provider behavior deterministically.
 */

import type { TranscriptSegment } from "@unison/contracts";

import {
	audioChunkMessage,
	buildRealtimeScribeUrl,
	commitMessage,
	parseRealtimeServerMessage,
	type RealtimeTranscriptionToken,
	SCRIBE_BYTES_PER_MS,
} from "./protocol";
import {
	applyTranscriptEvent,
	createRealtimeTranscriptState,
	type RealtimeTranscriptState,
	transcriptWithPartial,
} from "./transcript-state";

export type SocketLike = {
	onclose: (() => void) | null;
	onerror: (() => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onopen: (() => void) | null;
	readyState: number;
	close(): void;
	send(data: string): void;
};

const SOCKET_OPEN = 1;

export type TranscriptionSessionState =
	| "connecting"
	| "draining"
	| "error"
	| "idle"
	| "listening"
	| "reconnecting"
	| "stopped";

export type TranscriptionGapReason = "buffer_overflow" | "drain_ceiling";

export type TranscriptionGap = {
	fromMs: number;
	reason: TranscriptionGapReason;
	toMs: number;
};

export type TranscriptionSessionError = {
	code: string;
	fatal: boolean;
	message: string;
};

export type TranscriptionSnapshot = {
	committedText: string;
	error: TranscriptionSessionError | null;
	gaps: TranscriptionGap[];
	incomplete: boolean;
	lagging: boolean;
	partial: string;
	recordedMs: number;
	segments: TranscriptSegment[];
	state: TranscriptionSessionState;
};

export type TranscriptionSessionResult = {
	durationMs: number;
	gaps: TranscriptionGap[];
	incomplete: boolean;
	segments: TranscriptSegment[];
	transcript: string;
};

export type TranscriptionSessionConfig = {
	/** Hard ceiling on how long stop() waits for the provider to flush. */
	drainCeilingMs: number;
	/** Quiet window after a post-commit committed event that ends the drain. */
	drainQuiescenceMs: number;
	/** Tail of committed text seeded as previous_text on (re)connect. */
	firstChunkContextChars: number;
	/** Rolling audio retention span for replay across reconnects. */
	gapBufferMs: number;
	/** Unsent audio span above which the snapshot reports `lagging`. */
	laggingThresholdMs: number;
	/** [initial, max] backoff between reconnect attempts. */
	reconnectBackoffMs: [number, number];
	/** Replay overlap rewound before the last committed point on reconnect. */
	replayOverlapMs: number;
	/** Proactive socket rotation interval; null disables. */
	sessionRotateMs: number | null;
};

const DEFAULT_CONFIG: TranscriptionSessionConfig = {
	drainCeilingMs: 30_000,
	drainQuiescenceMs: 800,
	firstChunkContextChars: 600,
	gapBufferMs: 60_000,
	laggingThresholdMs: 4_000,
	reconnectBackoffMs: [500, 5_000],
	replayOverlapMs: 1_000,
	sessionRotateMs: 10 * 60_000,
};

export type TranscriptionSessionTimers = {
	clearTimeout(id: unknown): void;
	setTimeout(callback: () => void, ms: number): unknown;
};

export type TranscriptionSessionOptions = {
	config?: Partial<TranscriptionSessionConfig>;
	createSocket?: (url: string) => SocketLike;
	mintToken: () => Promise<RealtimeTranscriptionToken>;
	timers?: TranscriptionSessionTimers;
};

type RetainedChunk = {
	buffer: ArrayBuffer;
	fromMs: number;
	toMs: number;
};

type Connection = {
	commitSent: boolean;
	id: number;
	offsetMs: number | null;
	sentFirstChunk: boolean;
	socket: SocketLike;
};

function defaultCreateSocket(url: string): SocketLike {
	return new WebSocket(url) as unknown as SocketLike;
}

export class TranscriptionSession {
	private readonly config: TranscriptionSessionConfig;
	private readonly createSocket: (url: string) => SocketLike;
	private readonly mintToken: () => Promise<RealtimeTranscriptionToken>;
	private readonly timers: TranscriptionSessionTimers;

	private connection: Connection | null = null;
	private connectionCounter = 0;
	private disposed = false;
	private drainCeilingTimer: unknown = null;
	private drainCommitAcked = false;
	private drainQuiescenceTimer: unknown = null;
	private drainResolve: (() => void) | null = null;
	private error: TranscriptionSessionError | null = null;
	private gaps: TranscriptionGap[] = [];
	private lastCommittedMs = 0;
	private listeners = new Set<(snapshot: TranscriptionSnapshot) => void>();
	private reconnectAttempts = 0;
	private reconnectTimer: unknown = null;
	private retained: RetainedChunk[] = [];
	private rotateTimer: unknown = null;
	private rotating = false;
	private sendCursor = 0;
	private snapshot: TranscriptionSnapshot;
	private state: TranscriptionSessionState = "idle";
	private stopRequested = false;
	private totalMs = 0;
	private transcript: RealtimeTranscriptState = createRealtimeTranscriptState();

	constructor(options: TranscriptionSessionOptions) {
		this.config = { ...DEFAULT_CONFIG, ...options.config };
		this.createSocket = options.createSocket ?? defaultCreateSocket;
		this.mintToken = options.mintToken;
		this.timers = options.timers ?? {
			clearTimeout: (id) => clearTimeout(id as Parameters<typeof clearTimeout>[0]),
			setTimeout: (callback, ms) => setTimeout(callback, ms),
		};
		this.snapshot = this.buildSnapshot();
	}

	getSnapshot(): TranscriptionSnapshot {
		return this.snapshot;
	}

	subscribe(listener: (snapshot: TranscriptionSnapshot) => void): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	async start(): Promise<void> {
		if (this.state !== "idle") {
			throw new Error("Transcription session has already started.");
		}

		this.setState("connecting");
		await this.connect();
	}

	pushAudio(buffer: ArrayBuffer): void {
		if (this.stopRequested || this.disposed || buffer.byteLength === 0) {
			return;
		}

		const fromMs = this.totalMs;
		const toMs = fromMs + buffer.byteLength / SCRIBE_BYTES_PER_MS;

		this.totalMs = toMs;
		this.retained.push({ buffer, fromMs, toMs });
		this.trimRetention();
		this.flushSendQueue();
		this.emit();
	}

	/** Flush everything to the provider, wait for it to finish transcribing,
	 * and return the final transcript. The caller must stop its audio source
	 * first; pushes after stop() are ignored. */
	stop(): Promise<TranscriptionSessionResult> {
		if (this.stopRequested) {
			return Promise.resolve(this.buildResult());
		}

		this.stopRequested = true;
		this.setState("draining");

		return new Promise<TranscriptionSessionResult>((resolve) => {
			this.drainResolve = () => resolve(this.finalize());

			// A fatal provider error forbids reconnecting — nothing can flush, so
			// settle immediately with what arrived (flagged incomplete).
			if (this.error?.fatal) {
				this.recordGap(this.lastCommittedMs, this.totalMs, "drain_ceiling");
				this.resolveDrain();
				return;
			}

			this.drainCeilingTimer = this.timers.setTimeout(() => {
				if (this.sendCursor < this.retained.length || !this.drainCommitAcked) {
					this.recordGap(this.lastCommittedMs, this.totalMs, "drain_ceiling");
				}
				this.resolveDrain();
			}, this.config.drainCeilingMs);

			// Nothing was ever recorded or everything is already settled.
			if (this.totalMs === 0) {
				this.resolveDrain();
				return;
			}

			this.advanceDrain();
		});
	}

	cancel(): void {
		// A pending stop() must still settle — with whatever had arrived.
		this.resolveDrain();
		this.dispose();
		this.setState("idle");
	}

	private dispose(): void {
		this.disposed = true;
		this.clearTimer("reconnect");
		this.clearTimer("rotate");
		this.clearTimer("drainQuiescence");
		this.clearTimer("drainCeiling");
		this.closeConnection();
		this.retained = [];
	}

	private finalize(): TranscriptionSessionResult {
		const result = this.buildResult();

		this.dispose();
		this.setState(this.error?.fatal ? "error" : "stopped");

		return result;
	}

	private buildResult(): TranscriptionSessionResult {
		return {
			durationMs: Math.round(this.totalMs),
			gaps: [...this.gaps],
			incomplete: this.gaps.length > 0,
			segments: this.transcript.segments,
			transcript: transcriptWithPartial(this.transcript.committedText, this.transcript.partial),
		};
	}

	// ---- connection lifecycle -------------------------------------------------

	private async connect(): Promise<void> {
		let token: RealtimeTranscriptionToken;

		try {
			token = await this.mintToken();
		} catch (mintError) {
			this.handleConnectionFailure(mintError);
			return;
		}

		if (this.disposed) {
			return;
		}

		const socket = this.createSocket(buildRealtimeScribeUrl(token));

		this.connectionCounter += 1;
		const connection: Connection = {
			commitSent: false,
			id: this.connectionCounter,
			offsetMs: null,
			sentFirstChunk: false,
			socket,
		};

		await new Promise<void>((resolve) => {
			let settled = false;
			const settle = () => {
				if (!settled) {
					settled = true;
					resolve();
				}
			};

			socket.onopen = () => {
				this.connection = connection;
				this.reconnectAttempts = 0;
				this.rotating = false;
				if (!this.stopRequested) {
					this.setState("listening");
					this.armRotation();
				}
				this.flushSendQueue();
				if (this.stopRequested) {
					this.advanceDrain();
				}
				this.emit();
				settle();
			};
			socket.onerror = () => {
				if (!settled) {
					settle();
					this.handleConnectionFailure(new Error("Realtime transcription socket failed."));
					return;
				}
				// Post-open errors are followed by onclose; handled there.
			};
			socket.onmessage = (event) => this.handleMessage(connection, event.data);
			socket.onclose = () => {
				settle();
				if (this.connection === connection) {
					this.connection = null;
					this.handleConnectionLoss();
				}
			};
		});
	}

	private handleConnectionFailure(cause: unknown): void {
		if (this.state === "connecting" && this.reconnectAttempts === 0 && !this.stopRequested) {
			// First connect of start(): surface immediately rather than retrying
			// behind a UI that says "recording".
			this.error = {
				code: "connect_failed",
				fatal: true,
				message: cause instanceof Error ? cause.message : String(cause),
			};
			this.setState("error");
			throw cause instanceof Error ? cause : new Error(String(cause));
		}

		this.scheduleReconnect();
	}

	private handleConnectionLoss(): void {
		if (this.disposed || this.error?.fatal) {
			return;
		}

		this.clearTimer("rotate");
		this.rewindForReplay();

		if (this.stopRequested) {
			// Keep draining through a fresh connection; the ceiling bounds us.
			this.scheduleReconnect();
			return;
		}

		this.setState("reconnecting");
		this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		if (this.disposed || this.error?.fatal || this.reconnectTimer !== null) {
			return;
		}

		const [initial, max] = this.config.reconnectBackoffMs;
		const delay = Math.min(max, initial * 2 ** this.reconnectAttempts);

		this.reconnectAttempts += 1;
		this.reconnectTimer = this.timers.setTimeout(() => {
			this.reconnectTimer = null;
			void this.connect();
		}, delay);
	}

	/** Rewind the send cursor so the next connection replays audio from just
	 * before the last committed point. */
	private rewindForReplay(): void {
		const replayFromMs = Math.max(0, this.lastCommittedMs - this.config.replayOverlapMs);
		let cursor = 0;

		while (cursor < this.retained.length && (this.retained[cursor]?.toMs ?? 0) <= replayFromMs) {
			cursor += 1;
		}

		this.sendCursor = Math.min(cursor, this.sendCursor);
		this.emit();
	}

	private closeConnection(): void {
		const connection = this.connection;

		this.connection = null;

		if (connection) {
			connection.socket.onclose = null;
			connection.socket.onerror = null;
			connection.socket.onmessage = null;
			connection.socket.close();
		}
	}

	// ---- rotation -------------------------------------------------------------

	private armRotation(): void {
		this.clearTimer("rotate");

		if (this.config.sessionRotateMs === null) {
			return;
		}

		this.rotateTimer = this.timers.setTimeout(() => {
			this.rotateTimer = null;
			this.rotate();
		}, this.config.sessionRotateMs);
	}

	/** Graceful sequential rotation: commit + close the current socket, then
	 * reconnect with a fresh token. New audio queues in the retention window
	 * during the swap and is flushed (faster than realtime) after it. */
	private rotate(): void {
		const connection = this.connection;

		if (!connection || this.stopRequested || this.rotating) {
			return;
		}

		this.flushSendQueue();
		this.rotating = true;

		if (connection.socket.readyState === SOCKET_OPEN) {
			connection.socket.send(commitMessage());
			connection.commitSent = true;
		}

		// Give the provider a moment to flush committed text for the old
		// connection (messages keep arriving meanwhile), then swap; the
		// reconnect path replays anything the old commit did not cover.
		this.timers.setTimeout(() => {
			if (this.connection === connection) {
				this.connection = null;
				connection.socket.onclose = null;
				connection.socket.onerror = null;
				connection.socket.close();
				this.handleConnectionLoss();
			}
		}, 1_500);
	}

	// ---- send path ------------------------------------------------------------

	private flushSendQueue(): void {
		const connection = this.connection;

		if (!connection || connection.socket.readyState !== SOCKET_OPEN || this.rotating) {
			return;
		}

		while (this.sendCursor < this.retained.length) {
			const chunk = this.retained[this.sendCursor];

			if (!chunk) {
				break;
			}

			if (!connection.sentFirstChunk) {
				connection.offsetMs = chunk.fromMs;
				connection.sentFirstChunk = true;
				connection.socket.send(
					audioChunkMessage(chunk.buffer, {
						previousText: this.transcript.committedText.slice(-this.config.firstChunkContextChars),
					}),
				);
			} else {
				connection.socket.send(audioChunkMessage(chunk.buffer));
			}

			this.sendCursor += 1;
		}
	}

	private trimRetention(): void {
		const newest = this.retained.at(-1);

		if (!newest) {
			return;
		}

		// Drop fully committed audio (it will never need replaying).
		const committedFloor = this.lastCommittedMs - this.config.replayOverlapMs;

		while (this.retained.length > 0) {
			const oldest = this.retained[0];

			if (!oldest || oldest.toMs > committedFloor || this.sendCursor === 0) {
				break;
			}

			this.retained.shift();
			this.sendCursor -= 1;
		}

		// Enforce the rolling window; dropping UNSENT audio is recorded as a gap.
		while (this.retained.length > 0) {
			const oldest = this.retained[0];

			if (!oldest || newest.toMs - oldest.fromMs <= this.config.gapBufferMs) {
				break;
			}

			if (this.sendCursor === 0) {
				this.recordGap(oldest.fromMs, oldest.toMs, "buffer_overflow");
			} else {
				this.sendCursor -= 1;
			}

			this.retained.shift();
		}
	}

	private recordGap(fromMs: number, toMs: number, reason: TranscriptionGapReason): void {
		if (toMs <= fromMs) {
			return;
		}

		const last = this.gaps.at(-1);

		if (last && last.reason === reason && fromMs <= last.toMs) {
			last.toMs = Math.max(last.toMs, toMs);
			return;
		}

		this.gaps.push({ fromMs: Math.round(fromMs), reason, toMs: Math.round(toMs) });
	}

	// ---- receive path ----------------------------------------------------------

	private handleMessage(connection: Connection, data: unknown): void {
		const event = parseRealtimeServerMessage(data);

		if (!event || this.disposed) {
			return;
		}

		if (event.type === "session_started") {
			return;
		}

		if (event.type === "error") {
			this.handleProviderError(connection, event.code, event.message, event.severity);
			return;
		}

		if (event.type === "partial") {
			this.transcript = applyTranscriptEvent(this.transcript, {
				kind: "partial",
				text: event.text,
			});
			this.bumpDrainQuiescence();
			this.emit();
			return;
		}

		const offset = connection.offsetMs ?? 0;
		const startMs = event.startSec === null ? null : Math.round(offset + event.startSec * 1000);
		const endMs = event.endSec === null ? null : Math.round(offset + event.endSec * 1000);

		this.transcript = applyTranscriptEvent(this.transcript, {
			endMs,
			hasTimestamps: event.hasTimestamps,
			kind: "committed",
			languageCode: event.languageCode,
			source: event.fromFallbackParse ? "elevenlabs_realtime_fallback" : "elevenlabs_realtime",
			startMs,
			text: event.text,
		});

		if (endMs !== null) {
			this.lastCommittedMs = Math.max(this.lastCommittedMs, endMs);
			this.trimRetention();
		}

		if (this.stopRequested && connection.commitSent) {
			this.drainCommitAcked = true;
		}

		this.bumpDrainQuiescence();
		this.emit();
	}

	private handleProviderError(
		connection: Connection,
		code: string,
		message: string,
		severity: "fatal" | "informational" | "recoverable",
	): void {
		if (severity === "informational") {
			if (code === "insufficient_audio_activity" && this.stopRequested && connection.commitSent) {
				// Commit answered: there was nothing left to transcribe.
				this.drainCommitAcked = true;
				this.resolveDrain();
			}
			return;
		}

		if (severity === "fatal") {
			this.error = { code, fatal: true, message };
			this.closeConnection();
			this.clearTimer("reconnect");
			this.clearTimer("rotate");

			if (this.stopRequested) {
				this.recordGap(this.lastCommittedMs, this.totalMs, "drain_ceiling");
				this.resolveDrain();
			} else {
				this.setState("error");
			}
			return;
		}

		// Recoverable: drop the connection and let the reconnect path replay.
		this.error = { code, fatal: false, message };

		if (this.connection === connection) {
			this.closeConnection();
			this.handleConnectionLoss();
		}
	}

	// ---- drain ----------------------------------------------------------------

	private advanceDrain(): void {
		if (!this.stopRequested) {
			return;
		}

		const connection = this.connection;

		if (!connection || connection.socket.readyState !== SOCKET_OPEN) {
			// No live connection: the reconnect path (already scheduled by
			// handleConnectionLoss) keeps the drain going; if the session never
			// had a connection, kick one off.
			if (!this.reconnectTimer && !connection) {
				this.scheduleReconnect();
			}
			return;
		}

		this.flushSendQueue();

		if (this.sendCursor >= this.retained.length && !connection.commitSent) {
			connection.socket.send(commitMessage());
			connection.commitSent = true;
			this.bumpDrainQuiescence();
		}
	}

	private bumpDrainQuiescence(): void {
		if (!this.stopRequested) {
			return;
		}

		this.advanceDrain();
		this.clearTimer("drainQuiescence");

		if (!this.drainCommitAcked) {
			return;
		}

		this.drainQuiescenceTimer = this.timers.setTimeout(() => {
			this.drainQuiescenceTimer = null;
			this.resolveDrain();
		}, this.config.drainQuiescenceMs);
	}

	private resolveDrain(): void {
		const resolve = this.drainResolve;

		this.drainResolve = null;

		if (resolve) {
			resolve();
		}
	}

	// ---- bookkeeping -----------------------------------------------------------

	private clearTimer(kind: "drainCeiling" | "drainQuiescence" | "reconnect" | "rotate"): void {
		if (kind === "drainCeiling") {
			if (this.drainCeilingTimer !== null) {
				this.timers.clearTimeout(this.drainCeilingTimer);
			}
			this.drainCeilingTimer = null;
		} else if (kind === "drainQuiescence") {
			if (this.drainQuiescenceTimer !== null) {
				this.timers.clearTimeout(this.drainQuiescenceTimer);
			}
			this.drainQuiescenceTimer = null;
		} else if (kind === "reconnect") {
			if (this.reconnectTimer !== null) {
				this.timers.clearTimeout(this.reconnectTimer);
			}
			this.reconnectTimer = null;
		} else {
			if (this.rotateTimer !== null) {
				this.timers.clearTimeout(this.rotateTimer);
			}
			this.rotateTimer = null;
		}
	}

	private setState(state: TranscriptionSessionState): void {
		this.state = state;
		this.emit();
	}

	private unsentMs(): number {
		const next = this.retained[this.sendCursor];

		return next ? this.totalMs - next.fromMs : 0;
	}

	private buildSnapshot(): TranscriptionSnapshot {
		return {
			committedText: this.transcript.committedText,
			error: this.error,
			gaps: [...this.gaps],
			incomplete: this.gaps.length > 0,
			lagging: this.unsentMs() > this.config.laggingThresholdMs,
			partial: this.transcript.partial,
			recordedMs: Math.round(this.totalMs),
			segments: this.transcript.segments,
			state: this.state,
		};
	}

	private emit(): void {
		this.snapshot = this.buildSnapshot();

		for (const listener of this.listeners) {
			listener(this.snapshot);
		}
	}
}
