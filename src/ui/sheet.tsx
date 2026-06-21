"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
	type ComponentPropsWithoutRef,
	type ElementRef,
	forwardRef,
	type HTMLAttributes,
} from "react";
import { cn } from "./utils";

export const Sheet = DialogPrimitive.Root;

export const SheetTrigger = DialogPrimitive.Trigger;

export const SheetClose = DialogPrimitive.Close;

const sideClasses = {
	right:
		"fixed inset-y-0 right-0 h-full w-80 bg-surface-muted border-l border-(--border) shadow-lg flex flex-col z-50 rounded-tl-lg rounded-bl-lg",
	left: "fixed inset-y-0 left-0 h-full w-80 bg-surface-muted border-r border-(--border) shadow-lg flex flex-col z-50 rounded-tr-lg rounded-br-lg",
	top: "fixed inset-x-0 top-0 w-full bg-surface-muted border-b border-(--border) shadow-lg flex flex-col z-50 rounded-bl-lg rounded-br-lg",
	bottom:
		"fixed inset-x-0 bottom-0 w-full bg-surface-muted border-t border-(--border) shadow-lg flex flex-col z-50 rounded-tl-lg rounded-tr-lg",
};

interface SheetContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
	side?: "left" | "right" | "top" | "bottom";
}

export const SheetContent = forwardRef<
	ElementRef<typeof DialogPrimitive.Content>,
	SheetContentProps
>(({ className, children, side = "right", ...props }, ref) => (
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
		<DialogPrimitive.Content ref={ref} className={cn(sideClasses[side], className)} {...props}>
			{children}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
));

SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex flex-col gap-1.5 p-6 pb-4", className)} {...props} />;
}

export const SheetTitle = forwardRef<
	ElementRef<typeof DialogPrimitive.Title>,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title
		ref={ref}
		className={cn("text-base font-medium text-ink", className)}
		{...props}
	/>
));

SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = forwardRef<
	ElementRef<typeof DialogPrimitive.Description>,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description
		ref={ref}
		className={cn("text-sm text-ink-muted", className)}
		{...props}
	/>
));

SheetDescription.displayName = DialogPrimitive.Description.displayName;

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex justify-end gap-2 p-6 pt-4 mt-auto", className)} {...props} />;
}
