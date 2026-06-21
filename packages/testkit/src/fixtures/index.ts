import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The shared fixtures directory: golden wire payloads, recorded HTTP
 * exchanges, canned connector outputs — committed JSON consumed by api,
 * mobile, and web suites alike (Phase 9 points the client parsers here so the
 * three surfaces parse the same bytes).
 */

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/", import.meta.url));

export function fixturePath(...parts: string[]): string {
	return join(FIXTURES_DIR, ...parts);
}

/** Load a committed JSON fixture, e.g. `fixture("connectors/gmail-search-3")`. */
export function fixture<T = Record<string, unknown>>(name: string): T {
	const file = fixturePath(`${name}.json`);

	if (!existsSync(file)) {
		throw new Error(`Fixture "${name}" does not exist at ${file}.`);
	}

	return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Write a fixture (fixture-generation scripts only; tests read, never write). */
export function writeFixture(name: string, value: unknown): string {
	const file = fixturePath(`${name}.json`);

	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`, "utf8");

	return file;
}

export {
	type BootstrapResponseFixtureOptions,
	bootstrapResponsePayload,
	type ThreadMessageFixture,
	threadMessageFixture,
} from "./contracts";
