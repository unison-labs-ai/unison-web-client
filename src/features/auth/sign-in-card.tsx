"use client";

import { useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { GoogleMark } from "@/ui/brand/google-mark";
import { UnisonWordmark } from "@/ui/brand/unison-wordmark";
import { AuthScreen, AuthSteps } from "./auth-screen";

const buttonClass =
	"flex h-11 w-full items-center justify-center gap-3 rounded-md border border-(--border) bg-surface font-medium text-ink text-sm transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-50";

export function SignInCard({ initialError, next }: { initialError?: string; next?: string }) {
	// initialError carries OAuth-callback failures (?error=) back onto the card.
	const [error, setError] = useState<string | null>(
		initialError === "no_code"
			? "Sign-in was cancelled or expired. Try again."
			: (initialError ?? null),
	);
	const [loading, setLoading] = useState(false);

	const handleGoogleSignIn = async () => {
		setLoading(true);
		setError(null);

		const supabase = createBrowserSupabaseClient();
		const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

		const { error: oauthError } = await supabase.auth.signInWithOAuth({
			options: { redirectTo, scopes: "openid email profile" },
			provider: "google",
		});

		if (oauthError) {
			setError(oauthError.message);
			setLoading(false);
		}
	};

	return (
		<AuthScreen>
			<div className="flex flex-col items-center gap-2.5 text-center">
				<UnisonWordmark className="h-7 w-auto text-ink" />
				<p className="type-small text-ink-subtle">Your workspace, run by an agent.</p>
			</div>

			<AuthSteps active={1} />

			<div className="flex flex-col gap-3">
				{error ? <p className="type-small text-center text-danger">{error}</p> : null}

				<button
					className={buttonClass}
					disabled={loading}
					onClick={() => void handleGoogleSignIn()}
					type="button"
				>
					{loading ? (
						<span className="h-4 w-4 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-(--border) border-t-ink-muted" />
					) : (
						<GoogleMark />
					)}
					{loading ? "Signing in…" : "Continue with Google"}
				</button>
			</div>
		</AuthScreen>
	);
}
