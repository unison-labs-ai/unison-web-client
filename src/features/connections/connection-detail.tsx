"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type Connection,
	type ConnectionConnectResponse,
	type ConnectionProvider,
	connectionProviderSchema,
} from "@unison/contracts";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { connectErrorMessage } from "@/features/connections/connect-error";
import { useApi } from "@/lib/api-context";
import { Badge } from "@/ui/badge";
import { Breadcrumb } from "@/ui/breadcrumb";
import { Button } from "@/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/ui/dialog";
import { Skeleton } from "@/ui/skeleton";

type StatusVariant = "default" | "positive" | "danger" | "warning";

// "Connected" reads as neutral ink — only problem states get color.
function statusVariant(status: Connection["status"]): StatusVariant {
	switch (status) {
		case "error":
		case "revoked":
			return "danger";
		case "paused":
			return "warning";
		default:
			return "default";
	}
}

function statusLabel(status: Connection["status"]): string {
	switch (status) {
		case "connected":
			return "Connected";
		case "error":
			return "Error";
		case "not_connected":
			return "Not connected";
		case "paused":
			return "Paused";
		case "planned":
			return "Planned";
		case "revoked":
			return "Revoked";
	}
}

const PROVIDER_DISPLAY: Record<string, string> = {
	github: "GitHub",
	google: "Google",
	granola: "Granola",
	linear: "Linear",
	notion: "Notion",
	slack: "Slack",
	stripe: "Stripe",
	jira: "Jira",
	confluence: "Confluence",
	dropbox: "Dropbox",
	figma: "Figma",
	hubspot: "HubSpot",
	salesforce: "Salesforce",
	zendesk: "Zendesk",
	airtable: "Airtable",
	asana: "Asana",
	monday: "Monday",
	trello: "Trello",
	intercom: "Intercom",
};

function formatProvider(provider: string): string {
	if (PROVIDER_DISPLAY[provider]) return PROVIDER_DISPLAY[provider];
	return provider.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "Never";
	return new Date(iso).toLocaleString();
}

// What actually breaks when an account is disconnected (screens.md §7:
// the confirm "states what stops working").
const DISCONNECT_CONSEQUENCES: Partial<Record<ConnectionProvider, string>> = {
	google: "Gmail/Calendar triggers and tools stop working for automations using this account.",
	granola:
		"Meeting triggers and Granola tools stop working for automations using this account. Reconnect any time by signing in to Granola again.",
};

const GENERIC_DISCONNECT_CONSEQUENCE =
	"Triggers and tools that use this account stop working for automations until you reconnect.";

type DetailRowProps = {
	label: string;
	value: ReactNode;
};

function DetailRow({ label, value }: DetailRowProps) {
	return (
		<div
			style={{
				borderBottom: "1px solid var(--line)",
				display: "flex",
				gap: "16px",
				justifyContent: "space-between",
				padding: "10px 0",
			}}
		>
			<span className="type-small" style={{ color: "var(--ink-subtle)", flexShrink: 0 }}>
				{label}
			</span>
			<span style={{ color: "var(--ink)", fontSize: "13px", textAlign: "right" }}>{value}</span>
		</div>
	);
}

type ConnectionDetailProps = {
	provider: string;
};

export function ConnectionDetail({ provider }: ConnectionDetailProps) {
	const api = useApi();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [disconnectOpen, setDisconnectOpen] = useState(false);
	const popupRef = useRef<Window | null>(null);
	const pollRef = useRef<number | null>(null);
	const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
	const [infoMessage, setInfoMessage] = useState<string | null>(null);

	// Validate the route param against the contract enum: an unknown provider
	// is "not found", a known one without a row is "not connected".
	const parsedProvider = connectionProviderSchema.safeParse(provider);
	const knownProvider = parsedProvider.success ? parsedProvider.data : null;

	// getConnection derives from listConnections() and returns Connection | null
	// (there is no GET /v1/connections/:provider route to 404).
	const {
		data: connection,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		enabled: knownProvider !== null,
		queryFn: () => (knownProvider ? api.getConnection(knownProvider) : Promise.resolve(null)),
		queryKey: ["connection", provider],
		staleTime: 30_000,
	});

	function stopPolling() {
		if (pollRef.current !== null) {
			window.clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}

	// Stop any in-flight popup watch on unmount.
	useEffect(() => {
		return () => {
			if (pollRef.current !== null) {
				window.clearInterval(pollRef.current);
				pollRef.current = null;
			}
		};
	}, []);

	// While the OAuth popup is open, watch for it closing and refresh the
	// connection so the new status appears; give up after 5 minutes.
	function watchPopup(popup: Window) {
		stopPolling();
		const startedAt = Date.now();
		pollRef.current = window.setInterval(() => {
			if (popup.closed) {
				stopPolling();
				void queryClient.invalidateQueries({ queryKey: ["connections"] });
				void queryClient.invalidateQueries({ queryKey: ["connection", provider] });
				return;
			}
			if (Date.now() - startedAt > 5 * 60 * 1000) {
				stopPolling();
			}
		}, 2_000);
	}

	const connectMutation = useMutation({
		mutationFn: (target: ConnectionProvider) => api.connectProvider(target),
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
			} else {
				// 202 without a URL (non-Google providers): surface the server's
				// explanation instead of leaving the button looking broken.
				if (popup && !popup.closed) {
					popup.close();
				}
				setInfoMessage(result.message ?? "This provider can't be connected yet.");
			}
			await queryClient.invalidateQueries({ queryKey: ["connection", provider] });
			await queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
	});

	function handleConnect() {
		if (!knownProvider) return;
		setFallbackUrl(null);
		setInfoMessage(null);

		// Open the popup synchronously in the click handler — popup blockers
		// (Safari/Firefox always) kill window.open calls made after an await.
		// Granola included: its connect flow is MCP OAuth, same shape as Google.
		popupRef.current = window.open("", "_blank", "width=520,height=640");
		connectMutation.mutate(knownProvider);
	}

	const disconnectMutation = useMutation({
		mutationFn: (target: ConnectionProvider) => api.disconnectProvider(target),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["connections"] });
			router.push("/connections");
		},
	});

	const isUnknownProvider = knownProvider === null;
	const isNotConnected = !isLoading && !isError && knownProvider !== null && connection === null;

	return (
		<div style={{ margin: "0 auto", maxWidth: "768px", padding: "32px 20px 80px" }}>
			<Breadcrumb
				className="mb-5"
				currentTag="span"
				items={[
					{ href: "/connections", label: "Connections" },
					{ label: knownProvider ? formatProvider(knownProvider) : provider },
				]}
			/>

			{/* Loading */}
			{isLoading && (
				<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
					<Skeleton style={{ height: "32px", width: "200px" }} />
					<Skeleton style={{ height: "200px", width: "100%" }} />
				</div>
			)}

			{/* Unknown provider — not in the contract enum */}
			{isUnknownProvider && (
				<p className="type-small" style={{ color: "var(--ink-subtle)", margin: 0 }}>
					Unknown provider &ldquo;{provider}&rdquo;. Connection not found.
				</p>
			)}

			{/* General error */}
			{isError && (
				<div
					style={{
						alignItems: "center",
						display: "flex",
						flexDirection: "column",
						gap: "10px",
						padding: "24px 0",
					}}
				>
					<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
						Failed to load connection.
					</p>
					<Button onClick={() => void refetch()} variant="secondary">
						Retry
					</Button>
				</div>
			)}

			{/* Known provider with no connection row — render the provider page in
			    its "Not connected" state, not a dead end. */}
			{isNotConnected && knownProvider && (
				<>
					<div
						style={{
							alignItems: "center",
							display: "flex",
							gap: "12px",
							marginBottom: "12px",
						}}
					>
						<h1 className="type-h3" style={{ color: "var(--ink)", margin: 0 }}>
							{formatProvider(knownProvider)}
						</h1>
						<Badge variant="default">Not connected</Badge>
					</div>
					<p className="type-small" style={{ color: "var(--ink-subtle)", margin: "0 0 20px" }}>
						Connect your {formatProvider(knownProvider)} account to let your agent use its tools and
						triggers.
					</p>
					<Button disabled={connectMutation.isPending} onClick={handleConnect}>
						Connect
					</Button>
				</>
			)}

			{/* Content */}
			{connection && (
				<>
					{/* Header */}
					<div
						style={{
							alignItems: "center",
							display: "flex",
							gap: "12px",
							marginBottom: "28px",
						}}
					>
						<h1 className="type-h3" style={{ color: "var(--ink)", margin: 0 }}>
							{formatProvider(connection.provider)}
						</h1>
						<Badge variant={statusVariant(connection.status)}>
							{statusLabel(connection.status)}
						</Badge>
					</div>

					{/* Account section */}
					<section style={{ marginBottom: "24px" }}>
						<p
							className="type-small"
							style={{
								color: "var(--ink-subtle)",
								marginBottom: "4px",
								marginTop: 0,
								textTransform: "uppercase",
							}}
						>
							Account
						</p>
						<div
							style={{
								background: "var(--surface-muted)",
								border: "1px solid var(--border)",
								borderRadius: "var(--radius)",
								padding: "0 16px",
							}}
						>
							{(connection.displayName ?? connection.email) ? (
								<>
									{connection.displayName && (
										<DetailRow label="Name" value={connection.displayName} />
									)}
									{connection.email && <DetailRow label="Email" value={connection.email} />}
								</>
							) : (
								<DetailRow label="Account" value="—" />
							)}
							<DetailRow label="Connected since" value={formatDate(connection.connectedAt)} />
							<DetailRow label="Last sync" value={formatDate(connection.lastSyncAt)} />
							<DetailRow
								label="Scopes"
								value={connection.scopes.length > 0 ? connection.scopes.join(", ") : "None"}
							/>
						</div>
					</section>

					{/* Health section */}
					<section style={{ marginBottom: "24px" }}>
						<p
							className="type-small"
							style={{
								color: "var(--ink-subtle)",
								marginBottom: "4px",
								marginTop: 0,
								textTransform: "uppercase",
							}}
						>
							Health
						</p>
						<div
							style={{
								background: "var(--surface-muted)",
								border: "1px solid var(--border)",
								borderRadius: "var(--radius)",
								padding: "0 16px",
							}}
						>
							<DetailRow
								label="Status"
								value={connection.health.label || connection.health.state}
							/>
							{connection.health.detail && (
								<DetailRow label="Detail" value={connection.health.detail} />
							)}
							{connection.health.pendingJobs > 0 && (
								<DetailRow label="Pending jobs" value={connection.health.pendingJobs} />
							)}
							{connection.health.runningJobs > 0 && (
								<DetailRow label="Running jobs" value={connection.health.runningJobs} />
							)}
							{connection.health.failedJobs > 0 && (
								<DetailRow
									label="Failed jobs"
									value={
										<span style={{ color: "var(--danger)" }}>{connection.health.failedJobs}</span>
									}
								/>
							)}
						</div>
					</section>

					{/* Actions */}
					<div style={{ display: "flex", gap: "8px" }}>
						{connection.supportsConnect && (
							<Button
								disabled={connectMutation.isPending}
								onClick={handleConnect}
								variant="secondary"
							>
								{connection.status === "connected" ? "Re-authorize" : "Connect"}
							</Button>
						)}
						{connection.status === "connected" && (
							<Button onClick={() => setDisconnectOpen(true)} variant="destructive">
								Disconnect
							</Button>
						)}
					</div>
				</>
			)}

			{/* Connect-flow feedback (shared by connected and not-connected states) */}
			{connectMutation.isError && (
				<p className="type-small" style={{ color: "var(--danger)", margin: "10px 0 0" }}>
					{connectErrorMessage(connectMutation.error)}
				</p>
			)}
			{infoMessage && (
				<p className="type-small" style={{ color: "var(--ink-subtle)", margin: "10px 0 0" }}>
					{infoMessage}
				</p>
			)}
			{fallbackUrl && (
				<p className="type-small" style={{ color: "var(--ink-subtle)", margin: "10px 0 0" }}>
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
			)}

			{/* Disconnect confirmation dialog */}
			<Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Disconnect from {connection ? formatProvider(connection.provider) : provider}?
						</DialogTitle>
						<DialogDescription>
							{(knownProvider && DISCONNECT_CONSEQUENCES[knownProvider]) ??
								GENERIC_DISCONNECT_CONSEQUENCE}
						</DialogDescription>
					</DialogHeader>
					{disconnectMutation.isError && (
						<p className="type-small" style={{ color: "var(--danger)", margin: 0 }}>
							Failed to disconnect. Try again.
						</p>
					)}
					<DialogFooter>
						<Button onClick={() => setDisconnectOpen(false)} variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={disconnectMutation.isPending || !knownProvider}
							onClick={() => {
								if (knownProvider) {
									disconnectMutation.mutate(knownProvider);
								}
							}}
							variant="destructive"
						>
							{disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
