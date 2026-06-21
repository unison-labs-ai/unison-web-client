/** Pure transcript accumulation for realtime transcription.
 *
 * The session layer maps provider events to recording-relative milliseconds
 * (across reconnects and rotations) before reducing them here, so this module
 * knows nothing about sockets or wall clocks.
 *
 * Dedupe model, replacing the old ±50ms fuzzy heuristics:
 * - With `include_timestamps=true` the provider may emit a committed
 *   transcript twice — once without word timestamps and once with. The second
 *   arrival UPGRADES the last segment in place instead of appending.
 * - A committed event identical in text to the last segment with near-equal
 *   timing (≤ REPLAY_OVERLAP_TOLERANCE_MS) is a replay duplicate — the session
 *   re-sends a short audio overlap after a reconnect — and is skipped.
 * - Identical text with clearly different timing is a legitimate repeated
 *   phrase and is appended.
 *
 * `committedText` is maintained incrementally (append on commit) rather than
 * re-joined from all segments on every event; on hour-long recordings the
 * re-join was rendering-thread work that grew with transcript length.
 */

import type { TranscriptSegment } from "@unison/contracts";

const REPLAY_OVERLAP_TOLERANCE_MS = 1_500;

export type AppliedTranscriptEvent =
	| {
			endMs: number | null;
			hasTimestamps: boolean;
			kind: "committed";
			languageCode: string | null;
			source: string;
			startMs: number | null;
			text: string;
	  }
	| { kind: "partial"; text: string };

export type RealtimeTranscriptState = {
	committedText: string;
	nextIndex: number;
	partial: string;
	segments: TranscriptSegment[];
};

export function createRealtimeTranscriptState(): RealtimeTranscriptState {
	return {
		committedText: "",
		nextIndex: 0,
		partial: "",
		segments: [],
	};
}

export function normalizedTranscriptText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function transcriptWithPartial(committedText: string, partial: string): string {
	return [committedText, partial].filter(Boolean).join(" ").trim();
}

function timingMatches(
	segment: TranscriptSegment,
	startMs: number | null,
	endMs: number | null,
): boolean {
	if (
		segment.startMs === undefined ||
		segment.endMs === undefined ||
		startMs === null ||
		endMs === null
	) {
		return false;
	}

	return (
		Math.abs(segment.startMs - startMs) <= REPLAY_OVERLAP_TOLERANCE_MS &&
		Math.abs(segment.endMs - endMs) <= REPLAY_OVERLAP_TOLERANCE_MS
	);
}

function segmentHasTimestamps(segment: TranscriptSegment): boolean {
	return segment.startMs !== undefined && segment.endMs !== undefined;
}

export function applyTranscriptEvent(
	state: RealtimeTranscriptState,
	event: AppliedTranscriptEvent,
): RealtimeTranscriptState {
	const text = normalizedTranscriptText(event.text);

	if (!text) {
		return state;
	}

	const last = state.segments.at(-1);
	const sameTextAsLast = Boolean(last && normalizedTranscriptText(last.text) === text);

	if (event.kind === "partial") {
		// A partial that matches the last committed segment is the stale echo of
		// text that already committed — show nothing rather than doubling it.
		return {
			...state,
			partial: sameTextAsLast ? "" : text,
		};
	}

	// Dual-message upgrade: same text, last segment lacks timestamps, this
	// event carries them → enrich in place.
	if (last && sameTextAsLast && !segmentHasTimestamps(last) && event.hasTimestamps) {
		const upgraded: TranscriptSegment = {
			...last,
			endMs: event.endMs ?? undefined,
			metadata: {
				...last.metadata,
				languageCode: event.languageCode ?? last.metadata.languageCode,
				timestampsUpgraded: true,
			},
			startMs: event.startMs ?? undefined,
		};

		return {
			...state,
			partial: "",
			segments: [...state.segments.slice(0, -1), upgraded],
		};
	}

	// Replay duplicate: identical text landing at (near-)identical time.
	if (
		last &&
		sameTextAsLast &&
		(timingMatches(last, event.startMs, event.endMs) ||
			(!segmentHasTimestamps(last) && !event.hasTimestamps))
	) {
		return { ...state, partial: "" };
	}

	const segment: TranscriptSegment = {
		endMs: event.endMs ?? undefined,
		index: state.nextIndex,
		isFinal: true,
		metadata: {
			languageCode: event.languageCode,
			source: event.source,
		},
		startMs: event.startMs ?? undefined,
		text,
	};

	return {
		committedText: state.committedText ? `${state.committedText} ${text}` : text,
		nextIndex: state.nextIndex + 1,
		partial: "",
		segments: [...state.segments, segment],
	};
}
