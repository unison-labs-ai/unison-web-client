import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./utils";

const badgeVariants = cva("inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium", {
	variants: {
		variant: {
			default: "bg-surface-muted text-ink-muted",
			positive: "bg-positive-soft text-positive",
			danger: "bg-danger-soft text-danger",
			warning: "bg-warning-soft text-warning",
			sky: "bg-sky text-sky-foreground",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export interface BadgeProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
