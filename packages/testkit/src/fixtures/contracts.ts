/**
 * Structural mirrors of `@unison/contracts` wire shapes (no workspace dep —
 * same convention as `TestAuthContext` in auth/index.ts). Consumers bind the
 * real contract type via the generic parameter and stay type-safe at the call
 * site; suites that want runtime validation zod-parse the returned payload.
 */

export type ThreadMessageFixture = {
	attachments: unknown[];
	clientMessageId: string | null;
	content: string;
	contentFormat: string;
	createdAt: string;
	id: string;
	messageSeq: number;
	metadata: Record<string, unknown>;
	parentMessageId: string | null;
	role: string;
	sessionId: string;
	status: string;
	threadId: string;
	turnId: string | null;
	updatedAt: string;
};

const THREAD_MESSAGE_DEFAULTS: ThreadMessageFixture = {
	attachments: [],
	clientMessageId: null,
	content: "",
	contentFormat: "text",
	createdAt: "2026-06-08T12:00:00.000Z",
	id: "11111111-1111-4111-8111-111111111111",
	messageSeq: 1,
	metadata: {},
	parentMessageId: null,
	role: "user",
	sessionId: "22222222-2222-4222-8222-222222222222",
	status: "complete",
	threadId: "33333333-3333-4333-8333-333333333333",
	turnId: "44444444-4444-4444-8444-444444444444",
	updatedAt: "2026-06-08T12:00:00.000Z",
};

/** A complete `ThreadMessage`-shaped record; pass the contract type as `T`. */
export function threadMessageFixture<T extends object = ThreadMessageFixture>(
	overrides: Partial<T> = {},
): T {
	return { ...THREAD_MESSAGE_DEFAULTS, ...overrides } as T;
}

export type BootstrapResponseFixtureOptions = {
	brainInitStatus?: string;
	displayName?: string;
	email?: string;
	featureFlags?: Record<string, boolean>;
	now?: string;
	recommendedNextAction?: string;
	tenantDisplayName?: string;
	tenantId: string;
	userId: string;
};

/**
 * A `BootstrapResponse`-shaped payload. Returned untyped on purpose: API
 * suites pipe it through `bootstrapResponseSchema.parse(...)`, which keeps the
 * contract itself the source of truth.
 */
export function bootstrapResponsePayload(options: BootstrapResponseFixtureOptions): {
	auth: Record<string, unknown>;
	brainInitStatus: string;
	featureFlags: Record<string, boolean>;
	profile: Record<string, unknown>;
	recommendedNextAction: string;
	tenant: Record<string, unknown>;
} {
	const now = options.now ?? "2026-06-05T00:00:00.000Z";
	const displayName = options.displayName ?? "Tester";

	return {
		auth: {
			profileId: options.userId,
			tenantId: options.tenantId,
			userId: options.userId,
		},
		brainInitStatus: options.brainInitStatus ?? "queued",
		featureFlags: {
			capture: true,
			chat: true,
			connectors: true,
			notifications: true,
			rawAudioUpload: false,
			...options.featureFlags,
		},
		profile: {
			avatarUrl: null,
			createdAt: now,
			displayName,
			email: options.email ?? "a@b.local",
			id: options.userId,
			updatedAt: now,
		},
		recommendedNextAction: options.recommendedNextAction ?? "none",
		tenant: {
			createdAt: now,
			displayName: options.tenantDisplayName ?? `${displayName}'s brain`,
			id: options.tenantId,
			isDefault: true,
			role: "owner",
			status: "active",
			updatedAt: now,
		},
	};
}
