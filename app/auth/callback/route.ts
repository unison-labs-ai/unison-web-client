import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const { searchParams } = request.nextUrl;
	const code = searchParams.get("code");
	const next = searchParams.get("next") ?? "/";

	if (!code) {
		return NextResponse.redirect(new URL("/sign-in?error=no_code", request.url));
	}

	const cookieStore = await cookies();

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
					for (const { name, value, options } of cookiesToSet) {
						cookieStore.set(name, value, options);
					}
				},
			},
		},
	);

	const { error } = await supabase.auth.exchangeCodeForSession(code);

	if (error) {
		return NextResponse.redirect(
			new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, request.url),
		);
	}

	return NextResponse.redirect(new URL(sanitizeNextPath(next), request.url));
}

// Same-origin paths only: "//evil.com" and "/\evil.com" parse as
// protocol-relative URLs in browsers, so a bare startsWith("/") is not safe.
function sanitizeNextPath(next: string): string {
	if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
		return "/";
	}
	return next;
}
