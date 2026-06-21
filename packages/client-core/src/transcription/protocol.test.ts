import { describe, expect, test } from "bun:test";

import {
	arrayBufferToBase64,
	audioChunkMessage,
	buildRealtimeScribeUrl,
	commitMessage,
	parseRealtimeServerMessage,
} from "./protocol";

function pcm(bytes: number): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("protocol builders", () => {
	test("previous_text rides only when explicitly provided", () => {
		const bare = JSON.parse(audioChunkMessage(pcm(4)));
		const seeded = JSON.parse(audioChunkMessage(pcm(4), { previousText: "hello there" }));

		expect(bare.previous_text).toBeUndefined();
		expect(bare.message_type).toBe("input_audio_chunk");
		expect(bare.sample_rate).toBe(16_000);
		expect(seeded.previous_text).toBe("hello there");
	});

	test("empty previous_text is omitted, not sent as empty string", () => {
		const message = JSON.parse(audioChunkMessage(pcm(4), { previousText: "" }));

		expect("previous_text" in message).toBe(false);
	});

	test("commit message flushes without previous_text", () => {
		const message = JSON.parse(commitMessage());

		expect(message.commit).toBe(true);
		expect(message.audio_base_64).toBe("");
		expect("previous_text" in message).toBe(false);
	});

	test("websocket url carries the scribe params", () => {
		const url = new URL(
			buildRealtimeScribeUrl({
				audioFormat: "pcm_16000",
				modelId: "scribe_v2_realtime",
				token: "tok",
				websocketUrl: "wss://api.example.test/v1/speech-to-text/realtime",
			}),
		);

		expect(url.searchParams.get("commit_strategy")).toBe("vad");
		expect(url.searchParams.get("include_timestamps")).toBe("true");
		expect(url.searchParams.get("model_id")).toBe("scribe_v2_realtime");
		expect(url.searchParams.get("token")).toBe("tok");
	});

	test("base64 round-trips byte content", () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);

		expect(arrayBufferToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString("base64"));
	});
});

describe("parseRealtimeServerMessage", () => {
	test("exact committed types map with and without timestamps", () => {
		const withTs = parseRealtimeServerMessage(
			JSON.stringify({
				language_code: "en",
				message_type: "committed_transcript_with_timestamps",
				text: "hello world",
				words: [
					{ end: 0.6, start: 0.1, text: "hello" },
					{ end: 1.2, start: 0.7, text: "world" },
				],
			}),
		);
		const withoutTs = parseRealtimeServerMessage(
			JSON.stringify({ message_type: "committed_transcript", text: "hello world" }),
		);

		expect(withTs).toMatchObject({
			endSec: 1.2,
			fromFallbackParse: false,
			hasTimestamps: true,
			startSec: 0.1,
			text: "hello world",
			type: "committed",
		});
		expect(withoutTs).toMatchObject({
			fromFallbackParse: false,
			hasTimestamps: false,
			type: "committed",
		});
	});

	test("partials map by exact type and by default for unknown text events", () => {
		expect(
			parseRealtimeServerMessage(
				JSON.stringify({ message_type: "partial_transcript", text: "hel" }),
			),
		).toEqual({ text: "hel", type: "partial" });
		expect(
			parseRealtimeServerMessage(JSON.stringify({ message_type: "mystery_event", text: "hel" })),
		).toEqual({ text: "hel", type: "partial" });
	});

	test("unknown final-flagged types fall back tolerantly and are tagged", () => {
		const event = parseRealtimeServerMessage(
			JSON.stringify({ is_final: true, message_type: "new_final_kind", text: "done" }),
		);

		expect(event).toMatchObject({ fromFallbackParse: true, type: "committed" });
	});

	test("error severities route session reactions", () => {
		const fatal = parseRealtimeServerMessage(
			JSON.stringify({ message: "no", message_type: "auth_error" }),
		);
		const recoverable = parseRealtimeServerMessage(
			JSON.stringify({ message: "later", message_type: "session_time_limit_exceeded" }),
		);
		const informational = parseRealtimeServerMessage(
			JSON.stringify({ message: "quiet", message_type: "insufficient_audio_activity" }),
		);

		expect(fatal).toMatchObject({ severity: "fatal", type: "error" });
		expect(recoverable).toMatchObject({ severity: "recoverable", type: "error" });
		expect(informational).toMatchObject({ severity: "informational", type: "error" });
	});

	test("malformed payloads return null instead of throwing", () => {
		expect(parseRealtimeServerMessage("{not json")).toBeNull();
		expect(parseRealtimeServerMessage(12)).toBeNull();
		expect(parseRealtimeServerMessage(JSON.stringify(["array"]))).toBeNull();
		expect(parseRealtimeServerMessage(JSON.stringify({ message_type: "session_started" }))).toEqual(
			{ type: "session_started" },
		);
	});
});
