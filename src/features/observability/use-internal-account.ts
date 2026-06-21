"use client";

import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/lib/api-context";

export const INTERNAL_EMAIL_DOMAIN =
	process.env.NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN ?? "@example.com";

export type InternalAccountState = {
	email: string | null;
	/** True only when the signed-in email ends with the internal domain. */
	isInternal: boolean;
	/** True until the account profile has resolved once. Render nothing
	 * internal-only while this is true so the affordance never flashes. */
	isLoading: boolean;
};

/** Spec §5 access control: internal surfaces are visible only to
 * `@unisonlabs.ai` accounts. This is a UI affordance — the API enforces the
 * same check server-side. Shares the shell's ["me"] query, so it dedupes. */
export function useInternalAccount(): InternalAccountState {
	const api = useApi();
	const { data, isPending } = useQuery({
		queryFn: () => api.getMe(),
		queryKey: ["me"],
		staleTime: 5 * 60_000,
	});
	const email = data?.profile.email ?? null;
	return {
		email,
		isInternal: email?.endsWith(INTERNAL_EMAIL_DOMAIN) ?? false,
		isLoading: isPending,
	};
}
