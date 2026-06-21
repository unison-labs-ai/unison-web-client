import { fixture } from "./index";

/**
 * Golden wire fixtures (testing pack Phase 9, catalog CLI-006/CLI-007): the
 * canonical SSE event streams the client surfaces parse. The mobile and web
 * suites feed the SAME files through their decoders/reducers, and the web
 * suite schema-validates every fixture event against `@unison/contracts` —
 * so a contracts change that invalidates a fixture fails in review. The
 * producer side is pinned by the engine's golden event logs (ENG-024) and
 * the wire suite's per-route schema parses; regenerating those without
 * touching these fixtures will surface here as a client-suite failure.
 *
 * Streams:
 *   - `full-turn`    — every renderable kind: reasoning.summary, tool cards,
 *                      deltas, message.completed, session.completed.
 *   - `failed-turn`  — a delta then the error terminal.
 *   - `forward-compat` — input.requested (schema-only today) and an unknown
 *                      future kind; clients must tolerate both (additive
 *                      evolution per §11 versioning).
 */

export type WireStreamEvent = { type: string } & Record<string, unknown>;

export type WireExpectedProjection = {
	parts: Array<
		| { kind: "text"; text: string }
		| { kind: "tool"; output: Record<string, unknown>; status: string; tool: string }
	>;
	summaryPhraseDuringTurn: string;
};

export const WIRE_STREAM_NAMES = ["full-turn", "failed-turn", "forward-compat"] as const;
export type WireStreamName = (typeof WIRE_STREAM_NAMES)[number];

export function wireStreamFixture(name: WireStreamName): WireStreamEvent[] {
	return fixture<WireStreamEvent[]>(`wire/${name}`);
}

export function wireExpectedProjection(name: "full-turn"): WireExpectedProjection {
	return fixture<WireExpectedProjection>(`wire/${name}.expected`);
}

/**
 * Render a stream fixture as the exact SSE bytes the API emits
 * (`event: <type>\ndata: <json>\n\n` per event — mirrors the engine's
 * `sseLine`). Web's `parseSseBlock` consumes this form directly.
 */
export function wireSseText(name: WireStreamName): string {
	return wireStreamFixture(name)
		.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
		.join("");
}
