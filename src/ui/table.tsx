import {
	forwardRef,
	type HTMLAttributes,
	type TdHTMLAttributes,
	type ThHTMLAttributes,
} from "react";
import { cn } from "./utils";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
	({ className, ...props }, ref) => (
		<div className="overflow-x-auto">
			<table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
		</div>
	),
);

Table.displayName = "Table";

export const TableHeader = forwardRef<
	HTMLTableSectionElement,
	HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <thead ref={ref} className={cn(className)} {...props} />);

TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
	HTMLTableSectionElement,
	HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />);

TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
	({ className, ...props }, ref) => (
		<tr ref={ref} className={cn("border-b border-(--line)", className)} {...props} />
	),
);

TableRow.displayName = "TableRow";

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
	({ className, ...props }, ref) => (
		<th
			ref={ref}
			className={cn("h-10 px-3 text-left text-xs font-medium text-ink-subtle", className)}
			{...props}
		/>
	),
);

TableHead.displayName = "TableHead";

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
	({ className, ...props }, ref) => (
		<td
			ref={ref}
			className={cn("px-3 py-2.5 text-sm text-ink-muted align-middle", className)}
			{...props}
		/>
	),
);

TableCell.displayName = "TableCell";

export const TableCaption = forwardRef<
	HTMLTableCaptionElement,
	HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
	<caption ref={ref} className={cn("text-xs text-ink-subtle mt-2", className)} {...props} />
));

TableCaption.displayName = "TableCaption";
