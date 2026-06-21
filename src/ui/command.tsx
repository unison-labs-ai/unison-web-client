"use client";

import { Command as CommandPrimitive } from "cmdk";
import {
	type ComponentPropsWithoutRef,
	type ElementRef,
	forwardRef,
	type HTMLAttributes,
} from "react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { cn } from "./utils";

export const Command = forwardRef<
	ElementRef<typeof CommandPrimitive>,
	ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
	<CommandPrimitive
		ref={ref}
		className={cn("flex h-full w-full flex-col overflow-hidden rounded-lg bg-surface", className)}
		{...props}
	/>
));

Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends ComponentPropsWithoutRef<typeof Dialog> {
	/**
	 * cmdk's built-in filtering, forwarded to the Command root. Pass `false`
	 * when the caller filters items itself (e.g. mixing async results in).
	 */
	shouldFilter?: boolean;
}

export function CommandDialog({ children, shouldFilter, ...props }: CommandDialogProps) {
	return (
		<Dialog {...props}>
			<DialogContent className="overflow-hidden p-0">
				<DialogTitle className="sr-only">Command palette</DialogTitle>
				<Command shouldFilter={shouldFilter}>{children}</Command>
			</DialogContent>
		</Dialog>
	);
}

export const CommandInput = forwardRef<
	ElementRef<typeof CommandPrimitive.Input>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
	<div className="flex items-center border-b border-(--line) px-3 gap-2">
		<CommandPrimitive.Input
			ref={ref}
			className={cn(
				"flex-1 h-10 bg-transparent text-sm text-ink placeholder:text-ink-subtle outline-none",
				className,
			)}
			{...props}
		/>
	</div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = forwardRef<
	ElementRef<typeof CommandPrimitive.List>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.List
		ref={ref}
		className={cn("max-h-72 overflow-y-auto", className)}
		{...props}
	/>
));

CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = forwardRef<
	ElementRef<typeof CommandPrimitive.Empty>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Empty
		ref={ref}
		className={cn("py-6 text-center text-sm text-ink-subtle", className)}
		{...props}
	/>
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = forwardRef<
	ElementRef<typeof CommandPrimitive.Group>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Group
		ref={ref}
		className={cn(
			"p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-subtle",
			className,
		)}
		{...props}
	/>
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

export const CommandItem = forwardRef<
	ElementRef<typeof CommandPrimitive.Item>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Item
		ref={ref}
		className={cn(
			"flex items-center gap-2 px-2 py-1.5 text-sm text-ink-muted rounded-md aria-selected:bg-primary-soft aria-selected:text-ink",
			className,
		)}
		{...props}
	/>
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

export const CommandSeparator = forwardRef<
	ElementRef<typeof CommandPrimitive.Separator>,
	ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Separator
		ref={ref}
		className={cn("h-px bg-(--line) my-1", className)}
		{...props}
	/>
));

CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

export function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
	return <span className={cn("ml-auto text-xs text-ink-subtle font-mono", className)} {...props} />;
}
