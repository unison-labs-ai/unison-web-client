import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { emitSseBlocks, flushSseBuffer, parseSseBlock, SseParseError } from "./sse";

const eventSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("message.delta"), delta: z.string() }),
	z.object({ type: z.literal("session.completed"), status: z.enum(["ok", "stopped"]) }),
]);

type Event = z.infer<typeof eventSchema>;

function block(payload: unknown, eventName?: string): string {
	const data = `data: ${JSON.stringify(payload)}`;
	return eventName ? `event: ${eventName}\n${data}` : data;
}

describe("parseSseBlock — the wire forward-compat policy", () => {
	test("parses a known event", () => {
		expect(parseSseBlock(block({ type: "message.delta", delta: "hi" }), eventSchema)).toEqual({
			type: "message.delta",
			delta: "hi",
		});
	});

	test("skips an unknown event kind (additive wire evolution)", () => {
		expect(parseSseBlock(block({ type: "turn.v9.telemetry", x: 1 }), eventSchema)).toBeNull();
	});

	test("throws on a KNOWN kind with an invalid body", () => {
		expect(() =>
			parseSseBlock(block({ type: "session.completed", status: "exploded" }), eventSchema),
		).toThrow();
	});

	test("throws on a payload with no type field at all — not a future kind, a wire bug", () => {
		expect(() => parseSseBlock(block({ delta: "hi" }), eventSchema)).toThrow();
	});

	test("throws SseParseError on malformed JSON", () => {
		expect(() => parseSseBlock("data: {not json", eventSchema)).toThrow(SseParseError);
	});

	test("ignores empty data and [DONE] sentinels", () => {
		expect(parseSseBlock("", eventSchema)).toBeNull();
		expect(parseSseBlock("data: [DONE]", eventSchema)).toBeNull();
		expect(parseSseBlock(": heartbeat comment", eventSchema)).toBeNull();
	});

	test("surfaces server error events that do not match the schema", () => {
		expect(() =>
			parseSseBlock(block({ code: "boom", message: "It broke." }, "error"), eventSchema),
		).toThrow("SSE stream error: boom: It broke.");
	});

	test("schema-matching payloads pass through even under an error event name", () => {
		const errorAware = z.discriminatedUnion("type", [
			z.object({ type: z.literal("error"), message: z.string() }),
		]);
		expect(parseSseBlock(block({ type: "error", message: "x" }, "error"), errorAware)).toEqual({
			type: "error",
			message: "x",
		});
	});

	test("joins multi-line data fields and tolerates CRLF", () => {
		const crlfBlock = `event: message\r\ndata: {"type":"message.delta",\r\ndata: "delta":"hi"}`;
		expect(parseSseBlock(crlfBlock, eventSchema)).toEqual({ type: "message.delta", delta: "hi" });
	});
});

describe("emitSseBlocks / flushSseBuffer", () => {
	test("emits complete blocks and returns the unterminated tail", () => {
		const seen: Event[] = [];
		const tail = emitSseBlocks(
			`${block({ type: "message.delta", delta: "a" })}\n\n${block({ type: "message.delta", delta: "b" })}\n\ndata: {"type":"sess`,
			(event) => seen.push(event),
			eventSchema,
		);

		expect(seen.map((event) => ("delta" in event ? event.delta : event.status))).toEqual([
			"a",
			"b",
		]);
		expect(tail).toBe('data: {"type":"sess');
	});

	test("a tail completed by the next chunk parses across the boundary", () => {
		const seen: Event[] = [];
		let buffer = emitSseBlocks('data: {"type":"sess', (event) => seen.push(event), eventSchema);
		buffer = emitSseBlocks(
			`${buffer}ion.completed","status":"ok"}\n\n`,
			(event) => seen.push(event),
			eventSchema,
		);

		expect(seen).toEqual([{ type: "session.completed", status: "ok" }]);
		expect(buffer).toBe("");
	});

	test("flushSseBuffer drains a final block missing its terminating blank line", () => {
		const seen: Event[] = [];
		flushSseBuffer(
			`${block({ type: "message.delta", delta: "a" })}\n\n${block({ type: "session.completed", status: "ok" })}`,
			(event) => seen.push(event),
			eventSchema,
		);

		expect(seen).toEqual([
			{ type: "message.delta", delta: "a" },
			{ type: "session.completed", status: "ok" },
		]);
	});

	test("unknown kinds inside a stream are skipped without losing later events", () => {
		const seen: Event[] = [];
		emitSseBlocks(
			`${block({ type: "future.kind", payload: 1 })}\n\n${block({ type: "message.delta", delta: "after" })}\n\n`,
			(event) => seen.push(event),
			eventSchema,
		);

		expect(seen).toEqual([{ type: "message.delta", delta: "after" }]);
	});
});
