// catalog: CLI-004
import { describe, expect, it } from "bun:test";
import { installFetchMock } from "@unison/testkit/http";
import { z } from "zod";

import { emitSseBlocks, parseSseBlock, readSseStream, SseRequestError } from "./sse";

const eventSchema = z.object({
	index: z.number(),
	type: z.literal("message.delta"),
});

describe("SSE parsing", () => {
	it("parses a single data block", () => {
		expect(
			parseSseBlock('event: update\ndata: {"type":"message.delta","index":4}\n', eventSchema),
		).toEqual({
			index: 4,
			type: "message.delta",
		});
	});

	it("emits complete blocks and returns the tail", () => {
		const events: Array<z.infer<typeof eventSchema>> = [];
		const tail = emitSseBlocks(
			'data: {"type":"message.delta","index":1}\n\ndata: {"type":"message.delta"',
			(event) => events.push(event),
			eventSchema,
		);

		expect(events).toEqual([{ index: 1, type: "message.delta" }]);
		expect(tail).toBe('data: {"type":"message.delta"');
	});

	it("turns transport error events into readable errors", () => {
		expect(() =>
			parseSseBlock(
				'event: error\ndata: {"code":"internal_error","message":"Store failed."}\n',
				eventSchema,
			),
		).toThrow("SSE stream error: internal_error: Store failed.");
	});

	it("skips unknown event types but throws on malformed known events", () => {
		expect(parseSseBlock('data: {"type":"future.event","index":4}\n', eventSchema)).toBeNull();

		expect(() => parseSseBlock('data: {"type":"message.delta"}\n', eventSchema)).toThrow();
	});

	it("reports activity when the stream opens before event data arrives", async () => {
		let activityCount = 0;
		const openedWithHeaders: Array<string | null> = [];
		const fetchMock = installFetchMock({
			fallthrough: "error",
			routes: [
				{
					match: {},
					reply: () =>
						new Response(
							new ReadableStream<Uint8Array>({
								start(controller) {
									controller.close();
								},
							}),
							{
								headers: {
									"content-type": "text/event-stream",
									"x-unison-app-event-cursor": "7",
								},
								status: 200,
							},
						),
				},
			],
		});

		try {
			await readSseStream({
				onActivity: () => {
					activityCount += 1;
				},
				onEvent: () => {
					throw new Error("Unexpected SSE event.");
				},
				onOpen: (response) => {
					openedWithHeaders.push(response.headers.get("x-unison-app-event-cursor"));
				},
				schema: eventSchema,
				url: "http://example.test/events",
			});

			expect(activityCount).toBe(1);
			expect(openedWithHeaders).toEqual(["7"]);
		} finally {
			fetchMock.restore();
		}
	});

	it("includes API error detail for failed stream requests", async () => {
		const fetchMock = installFetchMock({
			fallthrough: "error",
			routes: [
				{
					match: {},
					reply: () => Response.json({ error: "Agent session was not found." }, { status: 404 }),
				},
			],
		});

		try {
			let caught: unknown;
			try {
				await readSseStream({
					onEvent: () => {
						throw new Error("Unexpected SSE event.");
					},
					schema: eventSchema,
					url: "http://example.test/events",
				});
			} catch (error) {
				caught = error;
			}

			expect(caught).toBeInstanceOf(SseRequestError);
			expect(caught).toHaveProperty(
				"message",
				"SSE request failed with status 404: Agent session was not found.",
			);
		} finally {
			fetchMock.restore();
		}
	});
});
