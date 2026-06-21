import type * as React from "react";
import { cn } from "./utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("rounded-md bg-surface animate-[shimmer_1.5s_ease-in-out_infinite]", className)}
			{...props}
		/>
	);
}
