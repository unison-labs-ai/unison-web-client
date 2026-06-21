"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection, ConnectionConnectResponse } from "@unison/contracts";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { connectErrorMessage } from "@/features/connections/connect-error";
import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { GoogleMark } from "@/ui/brand/google-mark";
import { UnisonWordmark } from "@/ui/brand/unison-wordmark";
import { AuthScreen, AuthSteps } from "./auth-screen";

// Web sign-in authenticates with Google *identity* scopes only (openid email
// profile) — that creates the account but never grants the Gmail/Calendar/Drive
// workspace scopes the agent runs on, so a fresh web account lands here with
// Google "not_connected". Mobile sidesteps this by requesting the full
// workspace scopes in the native sign-in consent itself; the web Supabase
// identity grant can't carry them, so we enforce the same floor *after*
// sign-in: hold the app behind a connect screen until the Google workspace
// connection exists, driving the user through the existing full-scope flow
// (POST /v1/connections/google/connect -> /oauth/google/callback), the same
// path the Connections page uses.

const CONNECTIONS_KEY = ["connections"] as const;

export function isGoogleConnected(connections: Connection[] | undefined): boolean {
	return connections?.find((item) => item.provider === "google")?.status === "connected";
}

const cardButtonClass =
	"flex h-11 w-full items-center justify-center gap-3 rounded-md border border-(--border) bg-surface font-medium text-ink text-sm transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-50";

function connectionGateErrorTitle(error: unknown): string {
	if (error instanceof WebApiError) {
		if (error.status === 401) {
			return "Your session expired";
		}
		if (error.status === 429) {
			return "Unison is catching up";
		}
		if (error.status >= 500) {
			return "Unison is having trouble";
		}
	}

	return "We couldn’t load your connections";
}

function connectionGateErrorDescription(error: unknown): string {
	if (error instanceof WebApiError) {
		if (error.status === 401) {
			return "Sign in again to continue.";
		}
		if (error.status === 429) {
			return "Too many requests are in flight. Wait a moment, then try again.";
		}
	}

	return "This checks your connection status before opening the app.";
}

function Spinner() {
	return (
		<span className="h-4 w-4 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-(--border) border-t-ink-muted" />
	);
}

export function GoogleConnectGate({ children }: { children: ReactNode }) {
	const api = useApi();
	const router = useRouter();
	const queryClient = useQueryClient();
	const popupRef = useRef<Window | null>(null);
	const pollRef = useRef<number | null>(null);
	const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
	const [account, setAccount] = useState<{ name?: string; email?: string; avatar?: string } | null>(
		null,
	);

	// Show *who* is signed in so this screen reads as step 2, not a failed login.
	useEffect(() => {
		const supabase = createBrowserSupabaseClient();
		void supabase.auth.getUser().then(({ data }) => {
			const user = data.user;
			if (!user) return;
			const meta = user.user_metadata ?? {};
			setAccount({
				avatar: meta.avatar_url ?? meta.picture,
				email: user.email,
				name: meta.full_name ?? meta.name,
			});
		});
	}, []);

	const { data, error, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listConnections(),
		queryKey: CONNECTIONS_KEY,
		staleTime: 30_000,
	});

	function stopPolling() {
		if (pollRef.current !== null) {
			window.clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}

	// Stop any in-flight popup watch on unmount (i.e. once the gate clears).
	useEffect(() => {
		return () => {
			if (pollRef.current !== null) {
				window.clearInterval(pollRef.current);
				pollRef.current = null;
			}
		};
	}, []);

	// While the OAuth popup is open, watch for it closing and refresh the
	// directory so the new status appears; give up after 5 minutes. Returning
	// focus to this window also refetches (react-query default), so the gate
	// usually clears the moment the user comes back — even before they close
	// the "you can close this window" landing page.
	function watchPopup(popup: Window) {
		stopPolling();
		const startedAt = Date.now();
		pollRef.current = window.setInterval(() => {
			if (popup.closed) {
				stopPolling();
				void queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
				return;
			}
			if (Date.now() - startedAt > 5 * 60 * 1000) {
				stopPolling();
			}
		}, 2_000);
	}

	const connectMutation = useMutation({
		mutationFn: () => api.connectProvider("google"),
		onError: () => {
			if (popupRef.current && !popupRef.current.closed) {
				popupRef.current.close();
			}
			popupRef.current = null;
		},
		onSuccess: async (result: ConnectionConnectResponse) => {
			const popup = popupRef.current;
			popupRef.current = null;
			if (result.connectUrl) {
				if (popup && !popup.closed) {
					popup.location.href = result.connectUrl;
					watchPopup(popup);
				} else {
					// Popup was blocked — offer a manual continuation link.
					setFallbackUrl(result.connectUrl);
				}
			} else if (popup && !popup.closed) {
				popup.close();
			}
			await queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
		},
	});

	function handleConnect() {
		setFallbackUrl(null);
		// Open the popup synchronously in the click handler — popup blockers
		// (Safari/Firefox always) kill window.open calls made after an await.
		popupRef.current = window.open("", "_blank", "width=520,height=640");
		connectMutation.mutate();
	}

	async function handleSignOut() {
		try {
			const supabase = createBrowserSupabaseClient();
			await supabase.auth.signOut();
			router.push("/sign-in");
		} catch (err) {
			console.error("Sign out failed:", err);
		}
	}

	// Known-connected: the floor is satisfied, render the app.
	if (!isLoading && !isError && isGoogleConnected(data)) {
		return <>{children}</>;
	}

	const googleStatus = data?.find((item) => item.provider === "google")?.status;
	const needsReconnect = googleStatus === "error" || googleStatus === "revoked";

	// Otherwise hold the app behind the connect floor. We fail *closed* on
	// error rather than letting an unconnected account slip through: during a
	// real connections-API outage the shell can't load either, so this is no
	// extra blast radius — and the user still has Retry / Sign out.
	return (
		<AuthScreen>
			<div className="flex flex-col gap-4">
				<UnisonWordmark className="mx-auto h-6 w-auto text-ink" />

				{account ? (
					<div className="flex items-center gap-3 rounded-lg border border-(--border) bg-surface/60 p-2.5">
						<Avatar>
							{account.avatar ? <AvatarImage alt="" src={account.avatar} /> : null}
							<AvatarFallback>
								{(account.name ?? account.email ?? "?").charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<p className="type-small truncate text-ink">{account.name ?? "Signed in"}</p>
							{account.email ? (
								<p className="type-extrasmall truncate text-ink-subtle">{account.email}</p>
							) : null}
						</div>
						<span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive-soft text-positive">
							<svg
								className="h-3 w-3"
								fill="none"
								role="img"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="3"
								viewBox="0 0 24 24"
							>
								<title>Signed in</title>
								<path d="M5 13l4 4L19 7" />
							</svg>
						</span>
					</div>
				) : null}

				<AuthSteps active={2} />
			</div>

			<div className="flex flex-col gap-1.5 text-center">
				<h1 className="type-h6 text-ink">
					{isError
						? connectionGateErrorTitle(error)
						: needsReconnect
							? "Reconnect Google to continue"
							: "Connect your Google Workspace"}
				</h1>
				<p className="type-small text-ink-subtle">
					{isError
						? connectionGateErrorDescription(error)
						: "Unison works inside your Gmail, Calendar & Drive. Grant access to finish setup."}
				</p>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-2">
					<span className="h-5 w-5 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-(--border) border-t-ink-muted" />
				</div>
			) : isError ? (
				<button className={cardButtonClass} onClick={() => void refetch()} type="button">
					Try again
				</button>
			) : (
				<div className="flex flex-col gap-3">
					{connectMutation.isError ? (
						<p className="type-small text-center text-danger">
							{connectErrorMessage(connectMutation.error)}
						</p>
					) : null}

					<button
						className={cardButtonClass}
						disabled={connectMutation.isPending}
						onClick={handleConnect}
						type="button"
					>
						{connectMutation.isPending ? <Spinner /> : <GoogleMark />}
						{needsReconnect ? "Reconnect Google" : "Connect Google Workspace"}
					</button>

					{fallbackUrl ? (
						<p className="type-small text-center text-ink-subtle">
							Popup blocked.{" "}
							<a
								className="text-ink-muted underline hover:text-ink"
								href={fallbackUrl}
								rel="noreferrer"
								target="_blank"
							>
								Continue in a new tab →
							</a>
						</p>
					) : null}
				</div>
			)}

			{/* Escape hatch — wrong Google account picked, or not ready to connect. */}
			<button
				className="type-small text-ink-subtle hover:text-ink"
				onClick={() => void handleSignOut()}
				type="button"
			>
				Not you? Sign out
			</button>
		</AuthScreen>
	);
}
