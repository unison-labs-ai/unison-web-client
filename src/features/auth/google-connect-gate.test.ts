import { describe, expect, it } from "bun:test";
import type { Connection, ConnectionProvider, ConnectionStatus } from "@unison/contracts";

import { isGoogleConnected } from "./google-connect-gate";

function makeConnection(provider: ConnectionProvider, status: ConnectionStatus): Connection {
	return {
		connectedAt: null,
		connectorAccountId: null,
		displayName: null,
		email: null,
		health: {
			detail: null,
			embeddingBacklog: 0,
			extractionBacklog: 0,
			failedJobs: 0,
			label: "Not connected",
			lastFailure: null,
			lastFailureAt: null,
			lastSourceEventAt: null,
			pendingJobs: 0,
			processedSourceEvents: 0,
			runningJobs: 0,
			state: "not_connected",
		},
		lastSyncAt: null,
		metadata: {},
		provider,
		readOnly: false,
		scopes: [],
		status,
		supportsConnect: provider === "google",
	};
}

describe("isGoogleConnected (web connect gate)", () => {
	it("is true only when the Google connection is connected", () => {
		expect(isGoogleConnected([makeConnection("google", "connected")])).toBe(true);
	});

	it("is false for every non-connected Google status", () => {
		for (const status of ["not_connected", "revoked", "error", "paused", "planned"] as const) {
			expect(isGoogleConnected([makeConnection("google", status)])).toBe(false);
		}
	});

	it("is false when Google is absent or the list is empty/undefined", () => {
		expect(isGoogleConnected(undefined)).toBe(false);
		expect(isGoogleConnected([])).toBe(false);
		// A connected *other* provider must not satisfy the Google floor.
		expect(isGoogleConnected([makeConnection("slack", "connected")])).toBe(false);
	});

	it("finds Google among other providers", () => {
		expect(
			isGoogleConnected([
				makeConnection("slack", "not_connected"),
				makeConnection("google", "connected"),
				makeConnection("granola", "connected"),
			]),
		).toBe(true);
	});
});
