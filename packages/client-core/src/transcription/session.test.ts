import { describe, expect, test } from "bun:test";

import { SCRIBE_BYTES_PER_MS } from "./protocol";
import { type SocketLike, TranscriptionSession, type TranscriptionSessionConfig } from "./session";

class FakeSocket implements SocketLike {
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onopen: (() => void) | null = null;
	readyState = 0;
	readonly sent: string[] = [];
	readonly url: string;

	constructor(url: string) {
		this.url = url;
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		if (this.readyState !== 3) {
			this.readyState = 3;
			this.onclose?.();
		}
	}

	open(): void {
		this.readyState = 1;
		this.onopen?.();
	}

	message(payload: Record<string, unknown>): void {
		this.onmessage?.({ data: JSON.stringify(payload) });
	}

	serverClose(): void {
		this.readyState = 3;
		this.onclose?.();
	}

	sentJson(): Record<string, unknown>[] {
		return this.sent.map((entry) => JSON.parse(entry) as Record<string, unknown>);
	}

	audioMessages(): Record<string, unknown>[] {
		return this.sentJson().filter((message) => message.audio_base_64 !== "");
	}

	commitMessages(): Record<string, unknown>[] {
		return this.sentJson().filter((message) => message.commit === true);
	}
}

function createFakeTimers() {
	let now = 0;
	let nextId = 1;
	const pending = new Map<number, { at: number; fn: () => void }>();

	async function flushMicrotasks(): Promise<void> {
		for (let index = 0; index < 8; index += 1) {
			await Promise.resolve();
		}
	}

	return {
		async advance(ms: number): Promise<void> {
			const target = now + ms;

			for (;;) {
				const due = [...pending.entries()]
					.filter(([, timer]) => timer.at <= target)
					.sort((a, b) => a[1].at - b[1].at)[0];

				if (!due) {
					break;
				}

				pending.delete(due[0]);
				now = due[1].at;
				due[1].fn();
				await flushMicrotasks();
			}

			now = target;
			await flushMicrotasks();
		},
		flushMicrotasks,
		timers: {
			clearTimeout(id: unknown) {
				pending.delete(id as number);
			},
			setTimeout(fn: () => void, ms: number) {
				const id = nextId;

				nextId += 1;
				pending.set(id, { at: now + ms, fn });

				return id;
			},
		},
	};
}

function pcmMs(ms: number): ArrayBuffer {
	return new Uint8Array(ms * SCRIBE_BYTES_PER_MS).buffer;
}

async function createHarness(config?: Partial<TranscriptionSessionConfig>) {
	const clock = createFakeTimers();
	const sockets: FakeSocket[] = [];
	let minted = 0;
	const session = new TranscriptionSession({
		config,
		createSocket: (url) => {
			const socket = new FakeSocket(url);

			sockets.push(socket);

			return socket;
		},
		mintToken: async () => {
			minted += 1;

			return {
				audioFormat: "pcm_16000",
				modelId: "scribe_v2_realtime",
				token: `token-${minted}`,
				websocketUrl: "wss://api.example.test/v1/speech-to-text/realtime",
			};
		},
		timers: clock.timers,
	});

	const startPromise = session.start();

	await clock.flushMicrotasks();
	sockets[0]?.open();
	await startPromise;

	return {
		clock,
		mintedCount: () => minted,
		session,
		socket: (index: number) => {
			const socket = sockets[index];

			if (!socket) {
				throw new Error(`No socket at index ${index} (have ${sockets.length}).`);
			}

			return socket;
		},
		sockets,
	};
}

function committedMessage(text: string, startSec: number, endSec: number): Record<string, unknown> {
	return {
		message_type: "committed_transcript_with_timestamps",
		text,
		words: [
			{ end: startSec + 0.1, start: startSec, text: text.split(" ")[0] },
			{ end: endSec, start: Math.max(startSec, endSec - 0.1), text: text.split(" ").at(-1) },
		],
	};
}

describe("TranscriptionSession", () => {
	test("happy path: streams, drains until quiescence, includes the trailing partial", async () => {
		const harness = await createHarness();
		const socket = harness.socket(0);

		harness.session.pushAudio(pcmMs(1000));
		harness.session.pushAudio(pcmMs(1000));
		socket.message({ message_type: "partial_transcript", text: "hello" });
		socket.message(committedMessage("hello world", 0, 1.5));
		harness.session.pushAudio(pcmMs(1000));
		socket.message({ message_type: "partial_transcript", text: "and then" });

		const stopPromise = harness.session.stop();

		await harness.clock.flushMicrotasks();
		// All audio flushed, then exactly one commit, after the audio.
		expect(socket.commitMessages()).toHaveLength(1);
		expect(socket.sentJson().at(-1)?.commit).toBe(true);

		socket.message(committedMessage("and then some", 1.5, 2.9));
		await harness.clock.advance(800);

		const result = await stopPromise;

		expect(result.transcript).toBe("hello world and then some");
		expect(result.incomplete).toBe(false);
		expect(result.durationMs).toBe(3000);
		expect(harness.session.getSnapshot().state).toBe("stopped");
	});

	test("drain keeps waiting past the first committed event until quiescence", async () => {
		const harness = await createHarness();
		const socket = harness.socket(0);

		harness.session.pushAudio(pcmMs(3000));

		const stopPromise = harness.session.stop();

		await harness.clock.flushMicrotasks();
		socket.message(committedMessage("first backlog segment", 0, 1));
		await harness.clock.advance(400);
		socket.message(committedMessage("second backlog segment", 1, 2));
		await harness.clock.advance(400);
		socket.message(committedMessage("third backlog segment", 2, 3));
		await harness.clock.advance(800);

		const result = await stopPromise;

		expect(result.transcript).toBe(
			"first backlog segment second backlog segment third backlog segment",
		);
		expect(result.incomplete).toBe(false);
	});

	test("insufficient_audio_activity after commit resolves the drain immediately", async () => {
		const harness = await createHarness();
		const socket = harness.socket(0);

		harness.session.pushAudio(pcmMs(500));
		socket.message(committedMessage("all settled", 0, 0.5));

		const stopPromise = harness.session.stop();

		await harness.clock.flushMicrotasks();
		socket.message({ message: "no pending audio", message_type: "insufficient_audio_activity" });
		await harness.clock.flushMicrotasks();

		const result = await stopPromise;

		expect(result.transcript).toBe("all settled");
		expect(result.incomplete).toBe(false);
	});

	test("drain ceiling marks the result incomplete with a gap", async () => {
		const harness = await createHarness({ drainCeilingMs: 5000 });
		const socket = harness.socket(0);

		harness.session.pushAudio(pcmMs(2000));
		socket.message(committedMessage("only the start", 0, 0.8));

		const stopPromise = harness.session.stop();

		await harness.clock.advance(5000);

		const result = await stopPromise;

		expect(result.transcript).toBe("only the start");
		expect(result.incomplete).toBe(true);
		expect(result.gaps).toEqual([{ fromMs: 800, reason: "drain_ceiling", toMs: 2000 }]);
	});

	test("previous_text rides only the first chunk of each connection", async () => {
		const harness = await createHarness();
		const first = harness.socket(0);

		harness.session.pushAudio(pcmMs(1000));
		harness.session.pushAudio(pcmMs(1000));
		first.message(committedMessage("context so far", 0, 1.8));
		harness.session.pushAudio(pcmMs(1000));

		const firstAudio = first.audioMessages();

		expect(firstAudio.every((message) => message.previous_text === undefined)).toBe(true);

		first.serverClose();
		await harness.clock.advance(500);
		harness.socket(1).open();
		await harness.clock.flushMicrotasks();

		const replayed = harness.socket(1).audioMessages();

		expect(replayed.length).toBeGreaterThan(0);
		expect(replayed[0]?.previous_text).toBe("context so far");
		expect(replayed.slice(1).every((message) => message.previous_text === undefined)).toBe(true);
	});

	test("a dropped connection reconnects and replays unacknowledged audio", async () => {
		const harness = await createHarness();
		const first = harness.socket(0);

		harness.session.pushAudio(pcmMs(1000));
		harness.session.pushAudio(pcmMs(1000));
		harness.session.pushAudio(pcmMs(1000));
		first.message(committedMessage("first two seconds", 0, 2));

		first.serverClose();
		expect(harness.session.getSnapshot().state).toBe("reconnecting");

		// Audio keeps arriving while disconnected.
		harness.session.pushAudio(pcmMs(1000));

		await harness.clock.advance(500);

		const second = harness.socket(1);

		second.open();
		await harness.clock.flushMicrotasks();
		expect(harness.session.getSnapshot().state).toBe("listening");
		expect(harness.mintedCount()).toBe(2);

		// Replays from the 1s overlap before lastCommitted (2000ms): chunks
		// covering 1000-2000, 2000-3000 and the offline 3000-4000.
		const replayedSpanMs = second
			.audioMessages()
			.reduce(
				(total, message) =>
					total + (((message.audio_base_64 as string).length / 4) * 3) / SCRIBE_BYTES_PER_MS,
				0,
			);

		expect(Math.round(replayedSpanMs)).toBe(3000);

		// Committed text from the new connection maps into recording time via
		// the replay offset (1000ms).
		second.message(committedMessage("rest of it", 1.0, 3.0));

		const stopPromise = harness.session.stop();

		await harness.clock.flushMicrotasks();
		second.message({ message: "done", message_type: "insufficient_audio_activity" });
		await harness.clock.flushMicrotasks();

		const result = await stopPromise;

		expect(result.transcript).toBe("first two seconds rest of it");
		expect(result.incomplete).toBe(false);
		expect(result.segments.at(-1)).toMatchObject({ endMs: 4000, startMs: 2000 });
	});

	test("retention overflow while disconnected records a gap and flags incomplete", async () => {
		const harness = await createHarness({
			gapBufferMs: 2000,
			laggingThresholdMs: 1500,
			reconnectBackoffMs: [60_000, 60_000],
		});
		const first = harness.socket(0);

		harness.session.pushAudio(pcmMs(500));
		first.message(committedMessage("kept", 0, 0.5));
		first.serverClose();

		for (let index = 0; index < 6; index += 1) {
			harness.session.pushAudio(pcmMs(1000));
		}

		const snapshot = harness.session.getSnapshot();

		expect(snapshot.incomplete).toBe(true);
		expect(snapshot.gaps[0]?.reason).toBe("buffer_overflow");
		expect(snapshot.lagging).toBe(true);
	});

	test("rotation commits the old socket, then resumes on a fresh one in order", async () => {
		const harness = await createHarness({ sessionRotateMs: 5000 });
		const first = harness.socket(0);

		harness.session.pushAudio(pcmMs(2000));
		first.message(committedMessage("before rotation", 0, 2));

		await harness.clock.advance(5000);

		// Rotation committed the old connection.
		expect(first.commitMessages()).toHaveLength(1);

		// Old socket flushes its tail during the grace window.
		harness.session.pushAudio(pcmMs(1000));
		expect(first.audioMessages().length).toBe(1);

		await harness.clock.advance(1500 + 500);

		const second = harness.socket(1);

		second.open();
		await harness.clock.flushMicrotasks();

		// The new connection replays from the retention window (the committed
		// 0-2000ms chunk is kept for overlap) plus the queued 2000-3000ms chunk,
		// so its session-relative clock restarts at recording-time 0: a commit
		// of the final second arrives as words 2.0-3.0.
		expect(second.audioMessages().length).toBeGreaterThan(0);
		second.message(committedMessage("after rotation", 2.0, 3.0));

		const stopPromise = harness.session.stop();

		await harness.clock.flushMicrotasks();
		second.message({ message: "done", message_type: "insufficient_audio_activity" });
		await harness.clock.flushMicrotasks();

		const result = await stopPromise;

		expect(result.transcript).toBe("before rotation after rotation");
		expect(result.incomplete).toBe(false);
		expect(result.segments.at(-1)).toMatchObject({ endMs: 3000, startMs: 2000 });
	});

	test("a fatal provider error surfaces and stop returns what exists, incomplete", async () => {
		const harness = await createHarness();
		const socket = harness.socket(0);

		harness.session.pushAudio(pcmMs(1000));
		socket.message(committedMessage("partial progress", 0, 0.5));
		socket.message({ message: "key revoked", message_type: "auth_error" });

		expect(harness.session.getSnapshot().state).toBe("error");
		expect(harness.session.getSnapshot().error).toMatchObject({ code: "auth_error", fatal: true });

		const result = await harness.session.stop();

		expect(result.transcript).toBe("partial progress");
		expect(result.incomplete).toBe(true);
		expect(harness.session.getSnapshot().state).toBe("error");
	});

	test("recoverable provider errors trigger the reconnect path", async () => {
		const harness = await createHarness();
		const first = harness.socket(0);

		harness.session.pushAudio(pcmMs(1000));
		first.message({ message: "rotate now", message_type: "session_time_limit_exceeded" });

		expect(harness.session.getSnapshot().state).toBe("reconnecting");

		await harness.clock.advance(500);
		harness.socket(1).open();
		await harness.clock.flushMicrotasks();

		expect(harness.session.getSnapshot().state).toBe("listening");
		expect(harness.session.getSnapshot().error?.fatal).toBe(false);
	});

	test("cancel settles a pending stop with whatever arrived", async () => {
		const harness = await createHarness();
		const socket = harness.socket(0);

		harness.session.pushAudio(pcmMs(1000));
		socket.message(committedMessage("kept text", 0, 0.9));

		const stopPromise = harness.session.stop();

		await harness.clock.flushMicrotasks();
		harness.session.cancel();

		const result = await stopPromise;

		expect(result.transcript).toBe("kept text");
	});
});
