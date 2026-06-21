"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/lib/api-context";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { Button } from "@/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import {
	ErrorState,
	GroupCard,
	GroupRow,
	PageFade,
	PageSection,
	useHydrated,
} from "@/ui/page-blocks";
import { Skeleton } from "@/ui/skeleton";

function Avatar({
	avatarUrl,
	displayName,
	size,
}: {
	avatarUrl: string | null | undefined;
	displayName: string;
	size: number;
}) {
	const initial = displayName.trim().charAt(0).toUpperCase() || "?";

	if (avatarUrl) {
		return (
			// biome-ignore lint/performance/noImgElement: avatar from arbitrary Google host; next/image gains nothing here
			<img
				alt={displayName}
				src={avatarUrl}
				style={{
					borderRadius: "50%",
					flexShrink: 0,
					height: `${size}px`,
					objectFit: "cover",
					width: `${size}px`,
				}}
			/>
		);
	}

	return (
		<div
			aria-hidden="true"
			style={{
				alignItems: "center",
				background: "var(--surface)",
				borderRadius: "50%",
				color: "var(--ink)",
				display: "flex",
				flexShrink: 0,
				fontSize: `${Math.round(size * 0.4)}px`,
				fontWeight: 500,
				height: `${size}px`,
				justifyContent: "center",
				width: `${size}px`,
			}}
		>
			{initial}
		</div>
	);
}

function ProfileRowSkeleton() {
	return (
		<div style={{ alignItems: "center", display: "flex", gap: "14px", padding: "14px 16px" }}>
			<Skeleton style={{ borderRadius: "50%", flexShrink: 0, height: "48px", width: "48px" }} />
			<div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "6px", minWidth: 0 }}>
				<Skeleton style={{ height: "14px", maxWidth: "100%", width: "160px" }} />
				<Skeleton style={{ height: "10px", maxWidth: "100%", width: "220px" }} />
			</div>
		</div>
	);
}

export function AccountPage() {
	const api = useApi();
	const router = useRouter();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");

	const hydrated = useHydrated();
	const { data, isLoading, isError, refetch } = useQuery({
		queryFn: () => api.getMe(),
		queryKey: ["me"],
		staleTime: 30_000,
	});
	// SSR always renders the pending branch — hold it until hydration is done.
	const showSkeleton = !hydrated || isLoading;

	const exportMutation = useMutation({
		mutationFn: () => api.requestAccountExport(),
	});

	const deleteMutation = useMutation({
		mutationFn: () => api.deleteAccount(),
		onSuccess: async () => {
			setDeleteDialogOpen(false);
			// Account + every session are already gone server-side — clear the local
			// session and bounce to sign-in.
			const supabase = createBrowserSupabaseClient();
			await supabase.auth.signOut();
			router.push("/sign-in");
		},
	});

	async function handleSignOut() {
		const supabase = createBrowserSupabaseClient();
		await supabase.auth.signOut();
		router.push("/sign-in");
	}

	const profile = data?.profile;

	return (
		<PageFade>
			{/* Profile — only this card depends on the "me" query */}
			<PageSection title="Profile">
				<GroupCard>
					{showSkeleton ? (
						<ProfileRowSkeleton />
					) : isError ? (
						<ErrorState
							message="Failed to load account information."
							onRetry={() => void refetch()}
						/>
					) : (
						<div
							style={{ alignItems: "center", display: "flex", gap: "14px", padding: "14px 16px" }}
						>
							<Avatar
								avatarUrl={profile?.avatarUrl}
								displayName={profile?.displayName ?? ""}
								size={48}
							/>
							<div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
								<p
									style={{
										color: "var(--ink)",
										fontSize: "14px",
										fontWeight: 500,
										margin: 0,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{profile?.displayName ?? "—"}
								</p>
								<p
									style={{
										color: "var(--ink-muted)",
										fontSize: "12px",
										margin: 0,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{profile?.email ?? "—"}
								</p>
							</div>
						</div>
					)}
				</GroupCard>
			</PageSection>

			{/* Account actions — static, render immediately even while profile loads */}
			<PageSection title="Account actions">
				<GroupCard>
					<GroupRow description="Request a copy of your data." title="Export data">
						<Button
							disabled={exportMutation.isPending || exportMutation.isSuccess}
							onClick={() => void exportMutation.mutate()}
							variant="secondary"
						>
							{exportMutation.isPending
								? "Requesting…"
								: exportMutation.isSuccess
									? "Requested"
									: "Export data"}
						</Button>
						{exportMutation.isSuccess && (
							<p style={{ color: "var(--positive)", fontSize: "12px", margin: 0 }}>
								Export requested — you&rsquo;ll be emailed a link.
							</p>
						)}
						{exportMutation.isError && (
							<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>
								Request failed. Try again.
							</p>
						)}
					</GroupRow>

					<GroupRow description="Sign out of your account on this device." title="Sign out">
						<Button onClick={() => void handleSignOut()} variant="ghost">
							Sign out
						</Button>
					</GroupRow>

					<GroupRow
						danger
						description="Permanently delete your account and your brain — every memory and connection."
						title="Delete account"
					>
						<Button
							disabled={deleteMutation.isSuccess || deleteMutation.isPending}
							onClick={() => {
								setDeleteConfirmText("");
								setDeleteDialogOpen(true);
							}}
							variant="destructive"
						>
							Delete account
						</Button>
					</GroupRow>
				</GroupCard>
			</PageSection>

			{/* Delete account dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete account</DialogTitle>
						<DialogDescription>
							This permanently deletes your Unison account{" "}
							<strong style={{ color: "var(--ink)", fontWeight: 500 }}>
								and your entire brain
							</strong>{" "}
							— every memory, note, and connection — on all devices. It is not just a sign-out, and
							it cannot be undone. Type{" "}
							<strong style={{ color: "var(--ink)", fontWeight: 500 }}>DELETE</strong> to confirm.
						</DialogDescription>
					</DialogHeader>

					<Input
						autoComplete="off"
						onChange={(e) => setDeleteConfirmText(e.target.value)}
						placeholder="Type DELETE to confirm"
						value={deleteConfirmText}
					/>

					{deleteMutation.isError && (
						<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>
							Failed to request deletion. Try again.
						</p>
					)}

					<DialogFooter>
						<Button onClick={() => setDeleteDialogOpen(false)} variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={deleteConfirmText !== "DELETE" || deleteMutation.isPending}
							onClick={() => void deleteMutation.mutate()}
							variant="destructive"
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete account"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageFade>
	);
}
