"use client";

import type { useRealtimeTranscription } from "./use-realtime-transcription";

type Transcription = Pick<
	ReturnType<typeof useRealtimeTranscription>,
	"cancel" | "start" | "state" | "stop"
>;

/** The four dictation handlers, shared by the home composer and the session
 * composer (they previously kept divergent copies). The composers differ only
 * in how a transcript lands in their input — `appendTranscript` performs the
 * insertion and returns the resulting value — and in how a message sends. */
export function useDictationControls(input: {
	/** Insert the transcript into the composer input; returns the next value. */
	appendTranscript: (transcript: string) => string;
	/** Guard evaluated before starting (e.g. a send in flight). */
	canStart?: () => boolean;
	focusInput?: () => void;
	setError: (message: string | null) => void;
	/** Submit the message; only wired on composers with a send-while-dictating
	 * affordance. */
	submit?: (nextValue: string) => Promise<void>;
	transcription: Transcription;
}) {
	const { appendTranscript, canStart, focusInput, setError, submit, transcription } = input;

	async function startDictation() {
		if (canStart && !canStart()) {
			return;
		}

		setError(null);
		await transcription.start().catch(() => undefined);
	}

	async function cancelDictation() {
		try {
			await transcription.cancel();
			setError(null);
			focusInput?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to cancel dictation");
		}
	}

	async function stopDictation() {
		if (transcription.state !== "recording") {
			return;
		}

		try {
			const result = await transcription.stop();

			appendTranscript(result.transcript);
			focusInput?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to stop dictation");
		}
	}

	async function sendDictation() {
		if (transcription.state !== "recording" || !submit) {
			return;
		}

		try {
			const result = await transcription.stop();
			const nextValue = appendTranscript(result.transcript);

			await submit(nextValue);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to send dictation");
		}
	}

	return { cancelDictation, sendDictation, startDictation, stopDictation };
}
