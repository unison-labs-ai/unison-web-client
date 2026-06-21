"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { buttonVariants } from "./button";
import { cn } from "./utils";

export type CalendarProps = ComponentProps<typeof DayPicker>;

/** Restyled react-day-picker (shadcn-style) mapped onto the app tokens.
 * Modifier classes land on the day `<td>`, so day-button state styling goes
 * through `[&>button]` child selectors — the `>button:hover` variants exist to
 * out-specify the base hover wash deterministically. */
export function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	return (
		<DayPicker
			className={cn("p-3", className)}
			classNames={{
				button_next: cn(buttonVariants({ size: "icon", variant: "ghost" }), "h-7 w-7"),
				button_previous: cn(buttonVariants({ size: "icon", variant: "ghost" }), "h-7 w-7"),
				caption_label: "text-[13px] font-medium text-ink",
				day: "p-0 text-center",
				day_button: cn(
					"flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent",
					"font-[inherit] text-xs text-ink-muted hover:bg-primary-soft hover:text-ink",
					"disabled:pointer-events-none",
				),
				disabled: "[&>button]:opacity-40",
				hidden: "invisible",
				month: "flex flex-col gap-3",
				month_caption: "flex h-7 items-center justify-center",
				month_grid: "w-full border-collapse",
				months: "relative flex flex-col gap-4 sm:flex-row",
				nav: "absolute inset-x-0 top-0 flex items-center justify-between",
				outside: "[&>button]:text-ink-subtle [&>button]:opacity-50",
				range_end: "rounded-r-md bg-primary-soft",
				range_middle: cn(
					"bg-primary-soft",
					"[&>button]:bg-transparent! [&>button]:text-ink! [&>button:hover]:bg-transparent! [&>button:hover]:text-ink!",
				),
				range_start: "rounded-l-md bg-primary-soft",
				selected: cn(
					"[&>button]:bg-primary [&>button]:font-medium [&>button]:text-primary-foreground",
					"[&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground",
				),
				today: "[&>button]:font-semibold [&>button]:text-ink",
				week: "mt-1 flex w-full",
				weekday: "w-8 text-[11px] font-normal text-ink-subtle",
				weekdays: "flex",
				...classNames,
			}}
			components={{
				// RDP also passes `disabled`, which is not a valid SVG attribute —
				// forward only what lucide accepts.
				Chevron: ({ className: chevronClassName, orientation }) =>
					orientation === "left" ? (
						<ChevronLeft className={chevronClassName} size={15} />
					) : (
						<ChevronRight className={chevronClassName} size={15} />
					),
			}}
			showOutsideDays={showOutsideDays}
			{...props}
		/>
	);
}
