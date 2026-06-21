import type { z } from "zod";

/** The one SSE decoder for every Unison client.
 *
 * Mobile and web previously kept separate copies of this logic and they
 * drifted: one guarded malformed JSON, the other hard-threw; one honoured the
 * SSE `event: error` name, the other ignored it; the unknown-kind checks were
 * written as mirror-image predicates. The wire's forward-compat policy is a
 * single concept, so it has a single implementation:
 *
 * - an event KIND this client does not know is skipped, never fatal — a newer
 *   server must not crash (or poison the reconnect cursor of) an older client;
 * - a KNOWN kind with an invalid body throws — silently dropping a corrupt
 *   terminal event would strand a turn unfinished with zero diagnostics;
 * - malformed JSON throws `SseParseError`;
 * - a schema-failing payload on an `event: error` block throws with the
 *   server's error detail instead of a Zod trace.
 */

export class SseParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SseParseError";
	}
}

export class SseRequestError extends Error {
	readonly detail: string | null;
	readonly status: number;

	constructor(status: number, detail: string | null = null) {
		super(
			detail
				? `SSE request failed with status ${status}: ${detail}`
				: `SSE request failed with status ${status}.`,
		);
		this.name = "SseRequestError";
		this.status = status;
		this.detail = detail;
	}
}

export function parseSseBlock<T>(block: string, schema: z.ZodType<T>): T | null {
	const lines = block.split(/\r?\n/);
	const eventName =
		lines
			.find((line) => line.startsWith("event:"))
			?.slice(6)
			.trim() ?? null;
	const data = lines
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice(5).trimStart())
		.join("\n");

	if (!data || data === "[DONE]") {
		return null;
	}

	let payload: unknown;
	try {
		payload = JSON.parse(data);
	} catch (error) {
		throw new SseParseError(error instanceof Error ? error.message : "Invalid SSE JSON payload.");
	}

	const parsed = schema.safeParse(payload);

	if (parsed.success) {
		return parsed.data;
	}

	if (eventName === "error") {
		throw new Error(`SSE stream error: ${streamErrorDetail(payload)}`);
	}

	// Additive wire evolution (§11): skipping requires the payload to actually
	// carry an unrecognized `type` — a payload with no `type` at all is not a
	// future event kind, it is a wire bug, and throws like any invalid body.
	const hasTypeField = typeof payload === "object" && payload !== null && "type" in payload;
	const unknownKind =
		hasTypeField &&
		parsed.error.issues.some((issue) => issue.path.length === 1 && issue.path[0] === "type");

	if (unknownKind) {
		return null;
	}

	throw parsed.error;
}

/** Emit every complete SSE block in `buffer`; return the unterminated tail to
 * carry into the next read. */
export function emitSseBlocks<T>(
	buffer: string,
	onEvent: (event: T) => void,
	schema: z.ZodType<T>,
): string {
	const normalized = buffer.replace(/\r\n/g, "\n");
	const parts = normalized.split(/\n\n/);
	const tail = parts.pop() ?? "";

	for (const part of parts) {
		const event = parseSseBlock(part, schema);

		if (event) {
			onEvent(event);
		}
	}

	return tail;
}

/** End-of-stream drain: emit remaining complete blocks, then parse the final
 * (possibly unterminated) block. */
export function flushSseBuffer<T>(
	buffer: string,
	onEvent: (event: T) => void,
	schema: z.ZodType<T>,
): void {
	const tail = emitSseBlocks(buffer, onEvent, schema);

	if (tail.trim().length === 0) {
		return;
	}

	const event = parseSseBlock(tail, schema);

	if (event) {
		onEvent(event);
	}
}

export type ReadSseStreamOptions<T> = {
	headers?: Record<string, string>;
	onActivity?: () => void;
	onEvent: (event: T) => void;
	schema: z.ZodType<T>;
	signal?: AbortSignal;
	url: string;
};

export async function readSseStream<T>(options: ReadSseStreamOptions<T>): Promise<void> {
	const response = await fetch(options.url, {
		headers: {
			accept: "text/event-stream",
			...options.headers,
		},
		method: "GET",
		signal: options.signal,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		const detail = errorDetailFromResponseText(text);
		throw new SseRequestError(response.status, detail);
	}

	options.onActivity?.();

	if (!response.body || !("getReader" in response.body)) {
		flushSseBuffer(await response.text(), options.onEvent, options.schema);
		return;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		options.onActivity?.();
		buffer = emitSseBlocks(
			buffer + decoder.decode(value, { stream: true }),
			options.onEvent,
			options.schema,
		);
	}

	flushSseBuffer(buffer + decoder.decode(), options.onEvent, options.schema);
}

function errorDetailFromResponseText(text: string): string | null {
	if (text.trim().length === 0) {
		return null;
	}

	try {
		const parsed = JSON.parse(text) as unknown;
		if (typeof parsed === "object" && parsed !== null) {
			const record = parsed as Record<string, unknown>;
			if (typeof record.error === "string") {
				return record.error;
			}
			// The API error envelope: { error: { code, message } }.
			if (typeof record.error === "object" && record.error !== null) {
				const envelope = record.error as Record<string, unknown>;
				if (typeof envelope.message === "string") {
					return envelope.message;
				}
			}
			if (typeof record.message === "string") {
				return record.message;
			}
		}
	} catch {
		return text.slice(0, 200);
	}

	return text.slice(0, 200);
}

function streamErrorDetail(payload: unknown): string {
	if (typeof payload === "object" && payload !== null) {
		const record = payload as Record<string, unknown>;
		const message = typeof record.message === "string" ? record.message : null;
		const code = typeof record.code === "string" ? record.code : null;

		if (message && code) {
			return `${code}: ${message}`;
		}

		if (message) {
			return message;
		}
	}

	return "The stream closed with an error.";
}
