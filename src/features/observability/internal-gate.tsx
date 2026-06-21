"use client";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PageShell } from "@/features/shell/page-shell";
import { Skeleton } from "@/ui/skeleton";
import { useInternalAccount } from "./use-internal-account";

const CARD_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Shared loading fallback for the observability routes — mirrors the
 * PageShell geometry of the real pages so the gate resolves without a jump. */
export function ObservabilitySkeleton() {
	return (
		<PageShell maxWidth={1200}>
			<div className="mb-6 flex min-h-10 items-center justify-between gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-8 w-32" />
			</div>
			<div className="flex flex-col gap-4">
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					{CARD_KEYS.map((key) => (
						<Skeleton className="h-24 w-full" key={key} />
					))}
				</div>
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-72 w-full" />
			</div>
		</PageShell>
	);
}

/** Spec §5: while the account loads, show skeletons; once loaded, non-internal
 * accounts get the normal not-found experience rather than learning that an
 * internal surface exists. */
export function InternalGate({ children }: { children: ReactNode }) {
	const { isInternal, isLoading } = useInternalAccount();
	if (isLoading) return <ObservabilitySkeleton />;
	if (!isInternal) notFound();
	return <>{children}</>;
}
