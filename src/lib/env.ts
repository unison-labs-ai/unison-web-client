export type WebEnv = {
	apiBaseUrl: string;
	supabasePublishableKey: string;
	supabaseUrl: string;
};

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

export const webEnv: WebEnv = {
	apiBaseUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? ""),
	supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
	supabaseUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
};

export function hasSupabaseConfig(env: WebEnv = webEnv): boolean {
	return env.supabaseUrl.length > 0 && env.supabasePublishableKey.length > 0;
}
