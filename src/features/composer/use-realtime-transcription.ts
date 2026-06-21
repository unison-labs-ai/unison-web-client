"use client";

import {
	TranscriptionSession,
	type TranscriptionSnapshot,
	transcriptWithPartial,
} from "@unison/client-core";
import type { TranscriptSegment } from "@unison/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { useApi } from "@/lib/api-context";
import { createWebPcmSource, type WebPcmSource } from "./worklet-audio-source";

export type TranscriptionState = "error" | "idle" | "recording" | "starting" | "stopping";

/** Connection health while dictating: `reconnecting` means the provider
 * socket dropped and the engine is replaying buffered audio; `catching_up`
 * means sends are backlogged. The mic keeps capturing through both. */
export type TranscriptionLink = "catching_up" | "live" | "reconnecting";

export type TranscriptionResult = {
	durationMs: number;
	incomplete: boolean;
	segments: TranscriptSegment[];
	transcript: string;
};

function clampDurationMs(ms: number): number {
	return Math.max(0, Math.round(ms));
}

function linkFromSnapshot(snapshot: TranscriptionSnapshot | null): TranscriptionLink {
	if (snapshot?.state === "reconnecting") {
		return "reconnecting";
	}

	return snapshot?.lagging ? "catching_up" : "live";
}

/** Web dictation engine glue: the microphone graph (worklet-audio-source.ts)
 * feeding a client-core TranscriptionSession, which owns the ElevenLabs
 * socket, reconnects, and the stop-drain protocol. Mirrors the mobile hook of
 * the same name. */
export function useRealtimeTranscription() {
	const api = useApi();
	const [state, setState] = useState<TranscriptionState>("idle");
	const [snapshot, setSnapshot] = useState<TranscriptionSnapshot | null>(null);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const engineRef = useRef<TranscriptionSession | null>(null);
	const sourceRef = useRef<WebPcmSource | null>(null);
	const unsubscribeRef = useRef<(() => void) | null>(null);
	const startedAtRef = useRef<number | null>(null);
	// DictationWaveform reads the analyser through this ref.
	const analyserRef = useRef<AnalyserNode | null>(null);

	useEffect(() => {
		if (state !== "recording" || !startedAtRef.current) {
			return;
		}

		const id = setInterval(() => {
			setElapsedMs(clampDurationMs(Date.now() - (startedAtRef.current ?? Date.now())));
		}, 250);

		return () => clearInterval(id);
	}, [state]);

	const teardown = useCallback(async () => {
		unsubscribeRef.current?.();
		unsubscribeRef.current = null;
		engineRef.current = null;
		analyserRef.current = null;

		const source = sourceRef.current;

		sourceRef.current = null;
		await source?.stop().catch(() => undefined);
	}, []);

	useEffect(() => {
		return () => {
			unsubscribeRef.current?.();
			engineRef.current?.cancel();
			engineRef.current = null;
			void sourceRef.current?.stop().catch(() => undefined);
			sourceRef.current = null;
		};
	}, []);

	const start = useCallback(async () => {
		setState("starting");
		setError(null);
		setSnapshot(null);
		setElapsedMs(0);

		const engine = new TranscriptionSession({
			mintToken: () => api.getRealtimeTranscriptionToken(),
		});
		const source = createWebPcmSource();

		try {
			engineRef.current = engine;
			sourceRef.current = source;
			unsubscribeRef.current = engine.subscribe((next) => {
				setSnapshot(next);

				if (next.error && (next.error.fatal || next.state === "error")) {
					setError(next.error.message);
				}
				if (next.state === "error") {
					setState("error");
				}
			});

			await engine.start();
			await source.start((pcm16) => engine.pushAudio(pcm16));
			analyserRef.current = source.analyser;
			startedAtRef.current = Date.now();
			setState("recording");
		} catch (startError) {
			engine.cancel();
			await teardown();
			startedAtRef.current = null;
			setState("error");
			setError(startError instanceof Error ? startError.message : String(startError));
			throw startError;
		}
	}, [api, teardown]);

	/** Stop the mic, then wait for the engine to flush everything the provider
	 * still owes us (commit + quiescence, bounded by the drain ceiling). */
	const stop = useCallback(async (): Promise<TranscriptionResult> => {
		setState("stopping");

		const source = sourceRef.current;

		sourceRef.current = null;
		analyserRef.current = null;
		await source?.stop().catch(() => undefined);

		const engine = engineRef.current;
		const result = engine
			? await engine.stop()
			: { durationMs: 0, gaps: [], incomplete: false, segments: [], transcript: "" };

		await teardown();

		const durationMs = startedAtRef.current
			? clampDurationMs(Date.now() - startedAtRef.current)
			: clampDurationMs(result.durationMs);

		startedAtRef.current = null;
		setState("idle");

		return {
			durationMs,
			incomplete: result.incomplete,
			segments: result.segments,
			transcript: result.transcript.trim(),
		};
	}, [teardown]);

	const cancel = useCallback(async () => {
		engineRef.current?.cancel();
		await teardown();
		startedAtRef.current = null;
		setState("idle");
		setSnapshot(null);
		setElapsedMs(0);
		setError(null);
	}, [teardown]);

	return {
		analyserRef,
		cancel,
		elapsedMs,
		error,
		link: linkFromSnapshot(snapshot),
		partial: snapshot?.partial ?? "",
		segments: snapshot?.segments ?? [],
		start,
		state,
		stop,
		transcript: snapshot ? transcriptWithPartial(snapshot.committedText, snapshot.partial) : "",
	};
}
