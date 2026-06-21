import { SessionViewSkeleton } from "@/features/sessions/session-skeleton";

/** Route-level boundary. The default <Link> prefetch picks this shell up for
 * the dynamic segment, so clicking a session paints the skeleton immediately
 * instead of freezing on the previous page while the RSC payload round-trips. */
export default function SessionLoading() {
	return <SessionViewSkeleton />;
}
