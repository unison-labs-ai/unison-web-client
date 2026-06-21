import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * HTTP test seams: a route-table fetch mock (the general form of the brain
 * smoke's hand-rolled Gmail fetch), and record/replay of real HTTP exchanges
 * as committed fixtures.
 */

export type FetchCall = {
	method: string;
	url: string;
};

export type FetchRouteMatch = {
	hostname?: string;
	method?: string;
	pathname?: string | RegExp;
};

export type FetchRoute = {
	match: FetchRouteMatch | ((url: URL, init: RequestInit | undefined) => boolean);
	/** A `Response`, a JSON-serializable body (200 application/json), or a factory. */
	reply:
		| Response
		| Record<string, unknown>
		| ((url: URL, init: RequestInit | undefined) => Response | Record<string, unknown>);
};

export type InstalledFetchMock = {
	calls: FetchCall[];
	restore(): void;
};

export function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		headers: { "content-type": "application/json" },
		status,
	});
}

function requestUrl(input: Parameters<typeof fetch>[0]): URL {
	return new URL(
		typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
	);
}

function requestMethod(input: Parameters<typeof fetch>[0], init: RequestInit | undefined): string {
	const method = init?.method ?? (input instanceof Request ? input.method : "GET");

	return method.toUpperCase();
}

function routeMatches(
	route: FetchRoute,
	url: URL,
	method: string,
	init: RequestInit | undefined,
): boolean {
	if (typeof route.match === "function") {
		return route.match(url, init);
	}

	if (route.match.hostname && route.match.hostname !== url.hostname) {
		return false;
	}

	if (route.match.method && route.match.method.toUpperCase() !== method) {
		return false;
	}

	if (route.match.pathname instanceof RegExp) {
		return route.match.pathname.test(url.pathname);
	}

	if (typeof route.match.pathname === "string") {
		return route.match.pathname === url.pathname;
	}

	return true;
}

function toResponse(reply: FetchRoute["reply"], url: URL, init: RequestInit | undefined): Response {
	const resolved = typeof reply === "function" ? reply(url, init) : reply;

	return resolved instanceof Response ? (resolved.clone() as Response) : jsonResponse(resolved);
}

/**
 * Replace `globalThis.fetch` with a route table. Unmatched requests either
 * fall through to the real fetch (`fallthrough: "passthrough"`, the default —
 * matches the brain smoke's behavior) or fail fast (`"error"`, the right
 * setting for fully scripted suites).
 */
export function installFetchMock(options: {
	fallthrough?: "error" | "passthrough";
	routes: FetchRoute[];
}): InstalledFetchMock {
	const originalFetch = globalThis.fetch;
	const calls: FetchCall[] = [];

	const mockFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
		const url = requestUrl(input);
		const method = requestMethod(input, init);

		calls.push({ method, url: url.toString() });

		const route = options.routes.find((candidate) => routeMatches(candidate, url, method, init));

		if (route) {
			return toResponse(route.reply, url, init);
		}

		if ((options.fallthrough ?? "passthrough") === "error") {
			throw new Error(`fetch mock: no route matches ${method} ${url.toString()}.`);
		}

		return originalFetch(input, init);
	}) as typeof fetch;

	mockFetch.preconnect = ((...args: Parameters<typeof fetch.preconnect>) =>
		originalFetch.preconnect(...args)) as typeof fetch.preconnect;
	globalThis.fetch = mockFetch;

	return {
		calls,
		restore() {
			globalThis.fetch = originalFetch;
		},
	};
}

// ---------------------------------------------------------------------------
// Recorded fetch: record real HTTP exchanges once, replay them forever.
// ---------------------------------------------------------------------------

export type RecordedExchange = {
	request: { method: string; url: string };
	response: { bodyText: string; headers: Record<string, string>; status: number };
};

export function shouldRecordFixtures(): boolean {
	const flag = process.env.UNISON_RECORD_FIXTURES;

	return flag === "1" || flag === "true";
}

/**
 * Replace `globalThis.fetch` with a fixture-backed replayer.
 *
 * Replay (default): every request must match the next-unconsumed recorded
 * exchange with the same method+URL; anything else throws. Nothing in CI ever
 * touches the network.
 *
 * Record (`UNISON_RECORD_FIXTURES=1`): requests pass through to the real
 * fetch and the exchanges are written to `fixtureFile` on `restore()`.
 */
export function recordedFetch(fixtureFile: string): InstalledFetchMock {
	const originalFetch = globalThis.fetch;
	const calls: FetchCall[] = [];
	const recording = shouldRecordFixtures();
	const recorded: RecordedExchange[] = [];
	const remaining: RecordedExchange[] = recording
		? []
		: (JSON.parse(readFileOrThrow(fixtureFile)) as RecordedExchange[]);

	const mockFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
		const url = requestUrl(input).toString();
		const method = requestMethod(input, init);

		calls.push({ method, url });

		if (recording) {
			const response = await originalFetch(input, init);
			const bodyText = await response.clone().text();

			recorded.push({
				request: { method, url },
				response: {
					bodyText,
					headers: Object.fromEntries(response.headers.entries()),
					status: response.status,
				},
			});

			return response;
		}

		const index = remaining.findIndex(
			(exchange) => exchange.request.method === method && exchange.request.url === url,
		);

		if (index === -1) {
			throw new Error(
				`recordedFetch: no recorded exchange for ${method} ${url} in ${fixtureFile}. ` +
					"Re-record with UNISON_RECORD_FIXTURES=1 if the request shape changed.",
			);
		}

		const [exchange] = remaining.splice(index, 1);

		return new Response(exchange?.response.bodyText ?? "", {
			headers: exchange?.response.headers,
			status: exchange?.response.status,
		});
	}) as typeof fetch;

	mockFetch.preconnect = ((...args: Parameters<typeof fetch.preconnect>) =>
		originalFetch.preconnect(...args)) as typeof fetch.preconnect;
	globalThis.fetch = mockFetch;

	return {
		calls,
		restore() {
			globalThis.fetch = originalFetch;

			if (recording) {
				mkdirSync(dirname(fixtureFile), { recursive: true });
				writeFileSync(fixtureFile, `${JSON.stringify(recorded, null, "\t")}\n`, "utf8");
			}
		},
	};
}

function readFileOrThrow(file: string): string {
	if (!existsSync(file)) {
		throw new Error(
			`recordedFetch: fixture ${file} does not exist. Record it once with UNISON_RECORD_FIXTURES=1.`,
		);
	}

	return readFileSync(file, "utf8");
}

export { parseSseDataBlocks, readSseSample } from "./sse";
