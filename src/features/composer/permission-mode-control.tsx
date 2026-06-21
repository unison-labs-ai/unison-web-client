"use client";

import type { ChatPermissionMode } from "@unison/contracts";
import { Check, ChevronDown, type LucideIcon, Shield, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { cn } from "@/ui/utils";

type PermissionModeMeta = {
	description: string;
	icon: LucideIcon;
	label: string;
	value: ChatPermissionMode;
};

// Ordered least → most permissive. The label + glyph are echoed on the trigger;
// the description only shows in the open menu. `as const` keeps it a non-empty
// tuple so the `?? PERMISSION_MODES[0]` fallback is always defined.
const PERMISSION_MODES = [
	{
		description: "Approve every action before it runs.",
		icon: Shield,
		label: "Ask",
		value: "ask",
	},
	{
		description: "Run read-only actions; ask before anything with side effects.",
		icon: ShieldCheck,
		label: "Allow safe",
		value: "allow_safe",
	},
	{
		description: "Run every action automatically, no approvals.",
		icon: Zap,
		label: "Allow all",
		value: "allow_all",
	},
] as const satisfies readonly PermissionModeMeta[];

/**
 * Composer permission-mode picker. A single pill trigger that opens a popover of
 * the three modes — replacing the old inline three-segment control. Reuses the
 * shared Popover (same trigger/content as the rest of the app) and keeps the
 * trigger in its active state for as long as the popover is open
 * (`data-[state=open]`), matching every other popover trigger in the client.
 */
export function PermissionModeControl({
	disabled,
	mode,
	onChange,
}: {
	disabled?: boolean;
	mode: ChatPermissionMode;
	onChange: (mode: ChatPermissionMode) => void;
}) {
	const [open, setOpen] = useState(false);
	const active = PERMISSION_MODES.find((option) => option.value === mode) ?? PERMISSION_MODES[0];
	const ActiveIcon = active.icon;

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					aria-label={`Permission mode: ${active.label}`}
					className={cn(
						"group inline-flex h-8 items-center gap-1.5 rounded-pill border border-(--border) bg-surface px-2.5 text-xs text-ink-muted",
						"hover:bg-primary-soft hover:text-ink data-[state=open]:bg-primary-soft data-[state=open]:text-ink",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:pointer-events-none disabled:opacity-50",
					)}
					data-no-composer-focus
					disabled={disabled}
					type="button"
				>
					<ActiveIcon size={14} />
					<span className="font-medium">{active.label}</span>
					<ChevronDown
						className="text-ink-subtle transition-transform group-data-[state=open]:rotate-180"
						size={13}
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-1" side="top" sideOffset={8}>
				{PERMISSION_MODES.map((option) => {
					const Icon = option.icon;
					const selected = option.value === mode;
					return (
						<button
							className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left outline-none hover:bg-primary-soft focus-visible:bg-primary-soft"
							key={option.value}
							onClick={() => {
								onChange(option.value);
								setOpen(false);
							}}
							type="button"
						>
							<Icon
								className={cn("mt-0.5 shrink-0", selected ? "text-ink" : "text-ink-subtle")}
								size={15}
							/>
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-1.5">
									<span
										className={cn("text-sm font-medium", selected ? "text-ink" : "text-ink-muted")}
									>
										{option.label}
									</span>
									{selected ? <Check className="text-ink" size={13} /> : null}
								</span>
								<span className="mt-0.5 block text-xs text-ink-subtle">{option.description}</span>
							</span>
						</button>
					);
				})}
			</PopoverContent>
		</Popover>
	);
}
