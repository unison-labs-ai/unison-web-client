import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "./utils";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-50 disabled:pointer-events-none border border-transparent",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-ink-muted",
				secondary: "border-(--border) bg-surface text-ink hover:bg-primary-soft",
				ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-primary-soft",
				destructive: "bg-danger-soft text-danger hover:bg-danger hover:text-danger-foreground",
			},
			size: {
				default: "h-8 px-3 text-sm",
				sm: "h-7 px-2 text-xs",
				lg: "h-9 px-4 text-sm",
				icon: "h-8 w-8 p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		);
	},
);
Button.displayName = "Button";
