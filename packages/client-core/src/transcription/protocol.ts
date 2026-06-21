/** ElevenLabs Scribe v2 Realtime wire protocol — the one implementation for
 * every Unison client.
 *
 * Mobile and web previously kept byte-identical copies of this module and the
 * copies had already started drifting. Beyond deduplication, this version
 * fixes two protocol violations the copies shared:
 *
 * - `previous_text` is only valid on the FIRST chunk of a connection (the API
 *   rejects it on later chunks). The old code attached the entire committed
 *   transcript to every chunk, which made upstream payloads grow linearly
 *   with recording length. Builders here take it as an explicit option so the
 *   session layer can send it exactly once per connection.
 * - The commit (flush) message no longer carries `previous_text` at all.
 *
 * Parsing is keyed on exact `message_type` values first; the old
 * substring-sniffing survives only as a tolerant fallback for unknown types,
 * and is tagged as such in the event so the state layer can tell.
 */

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const SCRIBE_SAMPLE_RATE = 16_000;
/** 16kHz mono PCM16 → 32 bytes of audio per millisecond. */
export const SCRIBE_BYTES_PER_MS = (SCRIBE_SAMPLE_RATE * 2) / 1000;

export type RealtimeTranscriptionToken = {
	audioFormat: string;
	modelId: string;
	token: string;
	websocketUrl: string;
};

/** How the session layer should react to a provider error. */
export type RealtimeErrorSeverity = "fatal" | "informational" | "recoverable";

export type RealtimeServerEvent =
	| {
			code: string;
			message: string;
			severity: RealtimeErrorSeverity;
			type: "error";
	  }
	| {
			endSec: number | null;
			fromFallbackParse: boolean;
			hasTimestamps: boolean;
			languageCode: string | null;
			startSec: number | null;
			text: string;
			type: "committed";
	  }
	| { text: string; type: "partial" }
	| { type: "session_started" };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function finiteSeconds(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function wordsEdgeSeconds(words: unknown, edge: "end" | "start"): number | null {
	if (!Array.isArray(words) || words.length === 0) {
		return null;
	}

	const word = edge === "start" ? words[0] : words[words.length - 1];

	return isRecord(word) ? finiteSeconds(word[edge]) : null;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let output = "";

	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index] ?? 0;
		const second = bytes[index + 1] ?? 0;
		const third = bytes[index + 2] ?? 0;
		const triplet = (first << 16) | (second << 8) | third;

		output += BASE64_CHARS.charAt((triplet >> 18) & 63);
		output += BASE64_CHARS.charAt((triplet >> 12) & 63);
		output += index + 1 < bytes.length ? BASE64_CHARS.charAt((triplet >> 6) & 63) : "=";
		output += index + 2 < bytes.length ? BASE64_CHARS.charAt(triplet & 63) : "=";
	}

	return output;
}

export function buildRealtimeScribeUrl(token: RealtimeTranscriptionToken): string {
	const url = new URL(token.websocketUrl);

	url.searchParams.set("audio_format", token.audioFormat);
	url.searchParams.set("commit_strategy", "vad");
	url.searchParams.set("include_timestamps", "true");
	url.searchParams.set("model_id", token.modelId);
	url.searchParams.set("token", token.token);

	return url.toString();
}

export function audioChunkMessage(
	buffer: ArrayBuffer,
	options: { previousText?: string } = {},
): string {
	return JSON.stringify({
		audio_base_64: arrayBufferToBase64(buffer),
		message_type: "input_audio_chunk",
		previous_text: options.previousText || undefined,
		sample_rate: SCRIBE_SAMPLE_RATE,
	});
}

export function commitMessage(): string {
	return JSON.stringify({
		audio_base_64: "",
		commit: true,
		message_type: "input_audio_chunk",
		sample_rate: SCRIBE_SAMPLE_RATE,
	});
}

/** Map a provider error code onto the session's reaction. Unknown codes are
 * treated as recoverable: a reconnect either clears them or surfaces a fatal
 * code on the next attempt. */
function errorSeverity(code: string): RealtimeErrorSeverity {
	switch (code) {
		case "auth_error":
		case "quota_exceeded":
		case "unaccepted_terms":
			return "fatal";
		case "chunk_size_exceeded":
		case "commit_throttled":
		case "input_error":
		case "insufficient_audio_activity":
			return "informational";
		default:
			return "recoverable";
	}
}

const ERROR_TYPES = new Set([
	"auth_error",
	"chunk_size_exceeded",
	"commit_throttled",
	"error",
	"input_error",
	"insufficient_audio_activity",
	"queue_overflow",
	"quota_exceeded",
	"rate_limited",
	"resource_exhausted",
	"session_time_limit_exceeded",
	"transcriber_error",
	"unaccepted_terms",
]);

export function parseRealtimeServerMessage(data: unknown): RealtimeServerEvent | null {
	if (typeof data !== "string") {
		return null;
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(data);
	} catch {
		return null;
	}

	if (!isRecord(parsed)) {
		return null;
	}

	const messageType = (
		optionalString(parsed.message_type) ??
		optionalString(parsed.type) ??
		""
	).toLowerCase();

	if (ERROR_TYPES.has(messageType) || messageType.includes("error")) {
		const code = ERROR_TYPES.has(messageType) ? messageType : "error";

		return {
			code,
			message:
				optionalString(parsed.message) ??
				optionalString(parsed.error) ??
				"Realtime transcription failed.",
			severity: errorSeverity(code),
			type: "error",
		};
	}

	if (messageType === "session_started") {
		return { type: "session_started" };
	}

	const text =
		optionalString(parsed.text) ??
		optionalString(parsed.transcript) ??
		optionalString(parsed.partial_transcript) ??
		optionalString(parsed.final_transcript);

	if (!text) {
		return null;
	}

	if (messageType === "partial_transcript") {
		return { text, type: "partial" };
	}

	const exactCommitted =
		messageType === "committed_transcript" ||
		messageType === "committed_transcript_with_timestamps";
	// Fallback for message types this client does not know: the old substring
	// heuristics, tagged so downstream consumers can tell.
	const fallbackCommitted =
		!exactCommitted &&
		(messageType.includes("committed") ||
			messageType.includes("final") ||
			parsed.is_final === true ||
			parsed.final === true);

	if (exactCommitted || fallbackCommitted) {
		const startSec = wordsEdgeSeconds(parsed.words, "start");
		const endSec = wordsEdgeSeconds(parsed.words, "end");

		return {
			endSec,
			fromFallbackParse: fallbackCommitted,
			hasTimestamps: startSec !== null && endSec !== null,
			languageCode: optionalString(parsed.language_code),
			startSec,
			text,
			type: "committed",
		};
	}

	return { text, type: "partial" };
}
