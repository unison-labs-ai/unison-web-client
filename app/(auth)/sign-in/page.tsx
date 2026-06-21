import { SignInCard } from "@/features/auth/sign-in-card";

export default async function SignInPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; next?: string }>;
}) {
	const params = await searchParams;
	return <SignInCard initialError={params.error} next={params.next} />;
}
