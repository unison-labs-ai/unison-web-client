import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const response = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					for (const { name, value, options } of cookiesToSet) {
						response.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname, search } = request.nextUrl;
	const isAuthPath =
		pathname === "/sign-in" || pathname.startsWith("/sign-in/") || pathname === "/auth/callback";

	// getUser() may have rotated the auth cookies; redirects must carry them
	// or the refreshed tokens are lost.
	function redirectWithCookies(url: URL): NextResponse {
		const redirect = NextResponse.redirect(url);
		for (const cookie of response.cookies.getAll()) {
			redirect.cookies.set(cookie);
		}
		return redirect;
	}

	if (!user && !isAuthPath) {
		const signInUrl = request.nextUrl.clone();
		signInUrl.pathname = "/sign-in";
		signInUrl.search = "";
		if (pathname !== "/" || search) {
			signInUrl.searchParams.set("next", `${pathname}${search}`);
		}
		return redirectWithCookies(signInUrl);
	}

	if (user && pathname === "/sign-in") {
		return redirectWithCookies(new URL("/", request.url));
	}

	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
