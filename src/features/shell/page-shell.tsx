import type { ReactNode } from "react";
import { cn } from "@/ui/utils";

type PageShellProps = {
	children: ReactNode;
	maxWidth?: number;
	title?: string;
	actions?: ReactNode;
	/** Pad the header's right edge clear of the floating notifications/approvals
	 * cluster (app-shell pins it to the top-right corner). Needed on wide pages
	 * whose header actions would otherwise slide under the bell. */
	reserveTopActions?: boolean;
};

type PageHeaderProps = {
	title: string;
	actions?: ReactNode;
	reserveTopActions?: boolean;
};

export function PageHeader({ actions, reserveTopActions, title }: PageHeaderProps) {
	return (
		<div
			className={cn(
				"mb-6 flex min-h-10 items-center justify-between gap-3",
				reserveTopActions && "md:pr-[var(--app-top-actions-reserve)]",
			)}
		>
			<h1 className="type-h3 m-0 min-w-0 text-ink">{title}</h1>
			{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
		</div>
	);
}

export function PageShell({
	actions,
	children,
	maxWidth = 768,
	reserveTopActions,
	title,
}: PageShellProps) {
	return (
		<div className="mx-auto w-full px-5 pb-20 pt-12" style={{ maxWidth }}>
			{title ? (
				<PageHeader actions={actions} reserveTopActions={reserveTopActions} title={title} />
			) : null}
			{children}
		</div>
	);
}
