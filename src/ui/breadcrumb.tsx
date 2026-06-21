import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { cn } from "./utils";

export type BreadcrumbItem = {
	label: string;
	/** Omit for the current page — rendered as the page heading, not a link. */
	href?: string;
};

/**
 * Shared breadcrumb trail (extracted from the session view header). Ancestor
 * items are subtle links; the last item is the current page and renders as a
 * truncating heading. Where the trail doubles as the page title row (session
 * view) it stays an `h1`; pages with their own heading pass `currentTag="span"`.
 */
export function Breadcrumb({
	className,
	currentTag: CurrentTag = "h1",
	items,
}: {
	className?: string;
	currentTag?: "h1" | "span";
	items: BreadcrumbItem[];
}) {
	const current = items[items.length - 1];

	return (
		<nav
			aria-label="Breadcrumb"
			className={cn("flex min-w-0 flex-1 items-center gap-[7px] text-sm", className)}
		>
			{items.slice(0, -1).map((item) => (
				<Fragment key={`${item.label}-${item.href ?? ""}`}>
					{item.href ? (
						<Link
							className="shrink-0 text-ink-subtle no-underline hover:text-ink-muted"
							href={item.href}
							style={{ fontWeight: 400 }}
						>
							{item.label}
						</Link>
					) : (
						<span className="shrink-0 text-ink-subtle" style={{ fontWeight: 400 }}>
							{item.label}
						</span>
					)}
					<ChevronRight aria-hidden className="shrink-0 text-ink-subtle" size={13} />
				</Fragment>
			))}
			{current ? (
				<CurrentTag
					className="m-0 min-w-0 truncate text-sm text-ink"
					style={{ fontWeight: 500 }}
					title={current.label}
				>
					{current.label}
				</CurrentTag>
			) : null}
		</nav>
	);
}
