"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { WebApiClient } from "@/lib/api";
import { hasSupabaseConfig, webEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const ApiContext = createContext<WebApiClient | null>(null);
const SESSION_REFRESH_SKEW_SECONDS = 60;

function hasUsableAccessToken(session: Session | null): session is Session {
	if (!session?.access_token) {
		return false;
	}

	if (!session.expires_at) {
		return true;
	}

	return session.expires_at - Math.floor(Date.now() / 1000) > SESSION_REFRESH_SKEW_SECONDS;
}

export function ApiProvider({ children }: { children: React.ReactNode }) {
	// The @supabase/ssr browser client reads the cookie session written by the
	// sign-in flow and middleware — it is the only client that sees the login.
	// Null when env is absent (e.g. prerender without config) — requests then
	// fail fast with the missing-token error instead of crashing at module init.
	const supabase = useMemo(() => (hasSupabaseConfig() ? createBrowserSupabaseClient() : null), []);
	const sessionRef = useRef<Session | null>(null);
	const redirectingToSignInRef = useRef(false);

	useEffect(() => {
		if (!supabase) return;
		const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
			sessionRef.current = session;
		});

		return () => {
			listener.subscription.unsubscribe();
		};
	}, [supabase]);

	const client = useMemo(
		() =>
			new WebApiClient({
				apiBaseUrl: webEnv.apiBaseUrl,
				// Child queries fire before this provider's effect has populated the
				// ref on a hard load, so fall back to reading the cookie session.
				getToken: async () => {
					if (hasUsableAccessToken(sessionRef.current)) {
						return sessionRef.current.access_token;
					}
					if (!supabase) return null;
					const { data } = await supabase.auth.getSession();
					sessionRef.current = data.session;
					return hasUsableAccessToken(data.session) ? data.session.access_token : null;
				},
				onUnauthorized: () => {
					if (redirectingToSignInRef.current || window.location.pathname === "/sign-in") {
						return;
					}
					redirectingToSignInRef.current = true;
					const next = `${window.location.pathname}${window.location.search}`;
					window.location.assign(`/sign-in?next=${encodeURIComponent(next)}`);
				},
			}),
		[supabase],
	);

	return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): WebApiClient {
	const client = useContext(ApiContext);
	if (!client) {
		throw new Error("useApi must be used within an ApiProvider");
	}
	return client;
}
