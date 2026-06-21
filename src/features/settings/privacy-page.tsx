"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	PrivacySettings,
	PrivacySettingsUpdateRequest,
	RawAudioRetention,
} from "@unison/contracts";
import { useState } from "react";
import { useApi } from "@/lib/api-context";
import {
	ErrorState,
	GroupCard,
	GroupCardSkeleton,
	GroupRow,
	PageFade,
	PageSection,
	SegmentedControl,
	useHydrated,
} from "@/ui/page-blocks";
import { Toggle } from "@/ui/toggle";

/** Mirror of mobile's rawAudioRetentionOptions (settings/privacy.tsx). */
const RAW_AUDIO_OPTIONS: { label: string; value: RawAudioRetention }[] = [
	{ label: "None", value: "none" },
	{ label: "Until transcript", value: "until_transcribed" },
	{ label: "Keep", value: "keep" },
];

type PrivacyToggleField = keyof Pick<
	PrivacySettings,
	| "storeTranscripts"
	| "allowConnectorIngestion"
	| "allowAiNotificationSummaries"
	| "showNotificationContentPreviews"
>;

/** Same controls and order as mobile's privacy screen. */
const PRIVACY_TOGGLE_FIELDS: {
	field: PrivacyToggleField;
	label: string;
	description: string;
}[] = [
	{
		field: "storeTranscripts",
		label: "Store transcripts",
		description: "Keep processed transcript text in your personal brain.",
	},
	{
		field: "allowConnectorIngestion",
		label: "Connector ingestion",
		description: "Read-only sources may create source events.",
	},
	{
		field: "allowAiNotificationSummaries",
		label: "AI notification summaries",
		description: "AI summaries may be used for notification bodies.",
	},
	{
		field: "showNotificationContentPreviews",
		label: "Notification previews",
		description: "Show descriptive source content in notification previews.",
	},
];

export function PrivacyPage() {
	const api = useApi();
	const queryClient = useQueryClient();

	// Pending state keyed by field, so one in-flight update only disables the
	// control it belongs to (a shared isPending froze every control at once).
	const [pendingFields, setPendingFields] = useState<ReadonlySet<string>>(new Set());

	const hydrated = useHydrated();
	const {
		data,
		isLoading: queryLoading,
		isError: queryError,
		refetch,
	} = useQuery({
		queryFn: () => api.getPrivacySettings(),
		queryKey: ["privacy-settings"],
		staleTime: 30_000,
	});
	// SSR always renders the pending branch — hold it until hydration is done.
	const isError = hydrated && queryError;
	const isLoading = !hydrated || queryLoading;

	const updateMutation = useMutation({
		mutationFn: (request: PrivacySettingsUpdateRequest) => api.updatePrivacySettings(request),
		onMutate: (request) => {
			setPendingFields((prev) => new Set([...prev, ...Object.keys(request)]));
		},
		onSettled: (_data, _error, request) => {
			setPendingFields((prev) => {
				const next = new Set(prev);
				for (const field of Object.keys(request)) {
					next.delete(field);
				}
				return next;
			});
		},
		onSuccess: (next) => {
			queryClient.setQueryData(["privacy-settings"], next);
		},
	});

	const rawAudioPending = pendingFields.has("rawAudioRetention");

	return (
		<PageFade>
			{updateMutation.isError && (
				<p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>
					Failed to update setting. Try again.
				</p>
			)}

			{isError ? (
				<ErrorState message="Failed to load privacy settings." onRetry={() => void refetch()} />
			) : (
				<>
					{/* Raw audio retention */}
					<PageSection
						description="How long original audio recordings are kept after capture."
						title="Raw audio"
					>
						{isLoading || !data ? (
							<GroupCardSkeleton controlWidth={220} rows={1} />
						) : (
							<GroupCard>
								<GroupRow title="Retention">
									<SegmentedControl
										disabled={rawAudioPending}
										onChange={(value) => void updateMutation.mutate({ rawAudioRetention: value })}
										options={RAW_AUDIO_OPTIONS}
										value={data.rawAudioRetention}
									/>
								</GroupRow>
							</GroupCard>
						)}
					</PageSection>

					{/* Preference toggles */}
					<PageSection title="Preferences">
						{isLoading || !data ? (
							<GroupCardSkeleton controlWidth={44} rows={4} />
						) : (
							<GroupCard>
								{PRIVACY_TOGGLE_FIELDS.map(({ field, label, description }) => (
									<GroupRow description={description} key={field} title={label}>
										<Toggle
											aria-label={label}
											checked={data[field]}
											disabled={pendingFields.has(field)}
											onCheckedChange={(checked) =>
												void updateMutation.mutate({ [field]: checked })
											}
										/>
									</GroupRow>
								))}
							</GroupCard>
						)}
					</PageSection>
				</>
			)}
		</PageFade>
	);
}
