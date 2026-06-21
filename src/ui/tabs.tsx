"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";
import { cn } from "./utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
	ElementRef<typeof TabsPrimitive.List>,
	ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref}
		className={cn("inline-flex items-center gap-0 border-b border-(--line) w-full", className)}
		{...props}
	/>
));

TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<
	ElementRef<typeof TabsPrimitive.Trigger>,
	ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"px-3 py-2 text-sm text-ink-subtle data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-primary -mb-px",
			className,
		)}
		{...props}
	/>
));

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<
	ElementRef<typeof TabsPrimitive.Content>,
	ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...props} />
));

TabsContent.displayName = TabsPrimitive.Content.displayName;
