"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationPreference, NotificationPreferenceListResponse } from "@unison/contracts";
import { useApi } from "@/lib/api-context";
import {
	EmptyState,
	ErrorState,
	GroupCard,
	GroupRow,
	PageFade,
	PageSection,
	PageSectionSkeleton,
	useHydrated,
} from "@/ui/page-blocks";
import { Toggle } from "@/ui/toggle";

function groupByCategory(
	preferences: NotificationPreference[],
): Map<string, NotificationPreference[]> {
	const map = new Map<string, NotificationPreference[]>();
	for (const pref of preferences) {
		const group = map.get(pref.eventCategory) ?? [];
		group.push(pref);
		map.set(pref.eventCategory, group);
	}
	return map;
}

function PreferenceRow({ preference }: { preference: NotificationPreference }) {
	const api = useApi();
	const queryClient = useQueryClient();

	const updateMutation = useMutation({
		// The API returns the SINGLE updated preference object (the PATCH
		// upserts one row), so splice it into the cached list rather than
		// expecting a list back.
		mutationFn: (enabled: boolean) =>
			api.updateNotificationPreferences({
				channel: preference.channel,
				enabled,
				eventCategory: preference.eventCategory,
			}),
		onSuccess: (updated) => {
			queryClient.setQueryData<NotificationPreferenceListResponse>(
				["notification-preferences"],
				(current) => {
					if (!current) return current;
					const exists = current.preferences.some(
						(p) => p.channel === updated.channel && p.eventCategory === updated.eventCategory,
					);
					return {
						...current,
						preferences: exists
							? current.preferences.map((p) =>
									p.channel === updated.channel && p.eventCategory === updated.eventCategory
										? updated
										: p,
								)
							: [...current.preferences, updated],
					};
				},
			);
		},
	});

	return (
		<GroupRow
			description={
				updateMutation.isError ? (
					<span style={{ color: "var(--danger)" }}>Update failed</span>
				) : undefined
			}
			title={<span style={{ textTransform: "capitalize" }}>{preference.channel}</span>}
		>
			<Toggle
				aria-label={`${preference.eventCategory} via ${preference.channel}`}
				checked={preference.enabled}
				disabled={updateMutation.isPending}
				onCheckedChange={(checked) => void updateMutation.mutate(checked)}
			/>
		</GroupRow>
	);
}

export function NotificationsSettingsPage() {
	const api = useApi();

	const hydrated = useHydrated();
	const query = useQuery({
		queryFn: () => api.listNotificationPreferences(),
		queryKey: ["notification-preferences"],
		staleTime: 30_000,
	});
	// SSR always renders the pending branch — hold it until hydration is done.
	const isError = hydrated && query.isError;
	const isLoading = !hydrated || (!isError && query.isLoading);

	const preferences: NotificationPreference[] = query.data?.preferences ?? [];
	const grouped = groupByCategory(preferences);

	return (
		<PageFade>
			{isLoading && (
				<>
					<PageSectionSkeleton controlWidth={44} rows={2} />
					<PageSectionSkeleton controlWidth={44} rows={2} />
				</>
			)}

			{isError && (
				<ErrorState
					message="Failed to load notification preferences."
					onRetry={() => void query.refetch()}
				/>
			)}

			{!isLoading && !isError && preferences.length === 0 && (
				<EmptyState message="No notification preferences configured" />
			)}

			{!isLoading &&
				!isError &&
				Array.from(grouped.entries()).map(([category, categoryPrefs]) => (
					<PageSection
						key={category}
						title={<span style={{ textTransform: "capitalize" }}>{category}</span>}
					>
						<GroupCard>
							{categoryPrefs.map((pref) => (
								<PreferenceRow key={pref.id} preference={pref} />
							))}
						</GroupCard>
					</PageSection>
				))}
		</PageFade>
	);
}
