"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection, ConnectionConnectResponse, ConnectionProvider } from "@unison/contracts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { connectErrorMessage } from "@/features/connections/connect-error";
import { PageShell } from "@/features/shell/page-shell";
import { useApi } from "@/lib/api-context";
import { Badge } from "@/ui/badge";
import { GoogleMark } from "@/ui/brand/google-mark";
import { GranolaMark } from "@/ui/brand/granola-mark";
import { LinearMark } from "@/ui/brand/linear-mark";
import { Button } from "@/ui/button";
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
	// Capitalize first letter of each word
	return provider.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PROVIDER_CAPABILITIES: Record<string, string> = {
	airtable: "Bases and records",
	asana: "Tasks and projects",
	confluence: "Pages and spaces",
	dropbox: "Files and folders",
	figma: "Design files and comments",
	github: "Repos, issues, and pull requests",
	google: "Gmail, Calendar, and Drive",
	granola: "Meeting notes and transcripts",
	hubspot: "Contacts and deals",
	intercom: "Conversations and contacts",
	jira: "Issues and boards",
	linear: "Issues and projects",
	monday: "Boards and items",
	notion: "Pages and databases",
	salesforce: "Leads and opportunities",
	slack: "Channels and messages",
	stripe: "Payments and customers",
	telegram: "Messages you send the bot",
	trello: "Boards and cards",
	zendesk: "Tickets and customers",
};

function providerCapability(provider: string): string {
	return PROVIDER_CAPABILITIES[provider] ?? `${formatProvider(provider)} tools for your agent`;
}

function ConnectionCard({
	connection,
	onConnect,
}: {
	connection: Connection;
	onConnect: (provider: ConnectionProvider) => void;
}) {
	const { status } = connection;
	const canConnect = connection.supportsConnect;
	const isConnected = status === "connected";
	const needsReconnect = status === "error" || status === "revoked";
	const isPlanned = status === "planned";

	return (
		<div className="relative flex flex-col gap-2 rounded-lg border border-(--border) bg-surface-muted p-4 transition-colors hover:border-[rgba(251,252,252,0.16)] hover:bg-primary-soft">
			{/* Stretched link — the whole card opens the provider page. */}
			<Link
				aria-label={formatProvider(connection.provider)}
				className="absolute inset-0"
				href={`/connections/${connection.provider}`}
			/>

			{/* Provider name + status */}
			<div
				style={{
					alignItems: "center",
					display: "flex",
					gap: "8px",
					justifyContent: "space-between",
				}}
			>
				<span
					style={{
						alignItems: "center",
						color: "var(--ink)",
						display: "flex",
						fontSize: "13px",
						fontWeight: 500,
						gap: "8px",
					}}
				>
					{connection.provider === "google" && <GoogleMark size={16} />}
					{connection.provider === "granola" && <GranolaMark size={16} />}
					{connection.provider === "linear" && <LinearMark size={16} />}
					{formatProvider(connection.provider)}
				</span>
				<Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
			</div>

			{/* Capability one-liner */}
			<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: 0 }}>
				{providerCapability(connection.provider)}
			</p>

			{/* Email / display name */}
			{(connection.email ?? connection.displayName) && (
				<p style={{ color: "var(--ink-muted)", fontSize: "13px", margin: 0 }}>
					{connection.displayName ?? connection.email}
					{connection.email && connection.displayName && connection.email !== connection.displayName
						? ` · ${connection.email}`
						: null}
				</p>
			)}

			{/* Health label */}
			{connection.health.label && (
				<p style={{ color: "var(--ink-subtle)", fontSize: "12px", margin: 0 }}>
					{connection.health.label}
				</p>
			)}

			{/* Action button (above the stretched link) */}
			{canConnect && !isConnected && !isPlanned && (
				<div className="relative" style={{ marginTop: "4px" }}>
					<Button
						onClick={() => onConnect(connection.provider)}
						size="sm"
						variant={needsReconnect ? "destructive" : "secondary"}
					>
						{needsReconnect ? "Reconnect" : "Connect"}
					</Button>
				</div>
			)}
			{isPlanned && (
				<div className="relative" style={{ marginTop: "4px" }}>
					<Button disabled size="sm" variant="secondary">
						Coming soon
					</Button>
				</div>
			)}
		</div>
	);
}

export function ConnectionsList() {
	const api = useApi();
	const queryClient = useQueryClient();
	const popupRef = useRef<Window | null>(null);
	const pollRef = useRef<number | null>(null);
	const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
	const [infoMessage, setInfoMessage] = useState<string | null>(null);

	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.listConnections(),
		queryKey: ["connections"],
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
	// directory so the new status appears; give up after 5 minutes.
	function watchPopup(popup: Window) {
		stopPolling();
		const startedAt = Date.now();
		pollRef.current = window.setInterval(() => {
			if (popup.closed) {
				stopPolling();
				void queryClient.invalidateQueries({ queryKey: ["connections"] });
				return;
			}
			if (Date.now() - startedAt > 5 * 60 * 1000) {
				stopPolling();
			}
		}, 2_000);
	}

	const connectMutation = useMutation({
		mutationFn: (provider: ConnectionProvider) => api.connectProvider(provider),
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
			await queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
	});

	function handleConnect(provider: ConnectionProvider) {
		setFallbackUrl(null);
		setInfoMessage(null);

		// Open the popup synchronously in the click handler — popup blockers
		// (Safari/Firefox always) kill window.open calls made after an await.
		// Granola included: its connect flow is MCP OAuth, same shape as Google
		// (the API-key alternative lives on the provider detail page).
		popupRef.current = window.open("", "_blank", "width=520,height=640");
		connectMutation.mutate(provider);
	}

	const connections: Connection[] = data ?? [];

	return (
		<PageShell title="Connections">
			{/* Loading */}
			{isLoading && (
				<div
					style={{
						display: "grid",
						gap: "12px",
						gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
					}}
				>
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} style={{ height: "100px", width: "100%" }} />
					))}
				</div>
			)}

			{/* Error */}
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
						Failed to load connections.
					</p>
					<Button onClick={() => void refetch()} variant="secondary">
						Retry
					</Button>
				</div>
			)}

			{/* Connect failure */}
			{connectMutation.isError && (
				<p className="type-small" style={{ color: "var(--danger)", margin: "0 0 12px" }}>
					{connectErrorMessage(connectMutation.error)}
				</p>
			)}

			{/* 202-without-URL explanation (non-Google providers) */}
			{infoMessage && (
				<p className="type-small" style={{ color: "var(--ink-subtle)", margin: "0 0 12px" }}>
					{infoMessage}
				</p>
			)}

			{/* Popup-blocked fallback */}
			{fallbackUrl && (
				<p className="type-small" style={{ color: "var(--ink-subtle)", margin: "0 0 12px" }}>
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

			{/* Empty */}
			{!isLoading && !isError && connections.length === 0 && (
				<p
					className="type-small"
					style={{ color: "var(--ink-subtle)", margin: 0, padding: "24px 0" }}
				>
					No connections configured.
				</p>
			)}

			{/* Grid of connection cards */}
			{!isLoading && !isError && connections.length > 0 && (
				<div
					style={{
						display: "grid",
						gap: "12px",
						gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
					}}
				>
					{connections.map((connection) => (
						<ConnectionCard
							connection={connection}
							key={connection.provider}
							onConnect={handleConnect}
						/>
					))}
				</div>
			)}
		</PageShell>
	);
}
