import type { ReactNode } from "react";

import { cn } from "@/ui/utils";

// Shared chrome for the two onboarding screens (sign-in + connect-Google) so
// they read as one cohesive flow. A faint center glow lifts the card off the
// near-black background; the card itself fades up on mount.
export function AuthScreen({ children }: { children: ReactNode }) {
	return (
		<div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute top-1/2 left-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,252,252,0.06),transparent_70%)] blur-2xl" />
			</div>
			<div className="relative flex w-full max-w-sm flex-col gap-6 rounded-xl border border-(--border) bg-surface-muted/95 p-8 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.75)] animate-[fade-up_0.4s_ease-out]">
				{children}
			</div>
		</div>
	);
}

// Two-segment progress so the connect screen can't be mistaken for sign-in:
// step 1 (Sign in) shows done, step 2 (Connect Google) shows current.
export function AuthSteps({ active }: { active: 1 | 2 }) {
	const labels = ["Sign in", "Connect Google"] as const;
	return (
		<div className="flex items-stretch gap-2">
			{labels.map((label, index) => {
				const step = index + 1;
				const done = step < active;
				const current = step === active;
				return (
					<div className="flex flex-1 flex-col gap-1.5" key={label}>
						<span
							className={cn(
								"h-0.5 w-full rounded-full transition-colors",
								done || current ? "bg-ink" : "bg-(--border)",
							)}
						/>
						<span
							className={cn(
								"type-extrasmall",
								current ? "text-ink" : done ? "text-ink-muted" : "text-ink-subtle",
							)}
						>
							{done ? "✓ " : ""}
							{label}
						</span>
					</div>
				);
			})}
		</div>
	);
}
