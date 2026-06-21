"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageShell } from "@/features/shell/page-shell";
import { TabNav, type TabNavItem } from "@/ui/tab-nav";

type SettingsTab = "account" | "permissions" | "notifications" | "skills" | "privacy";

const TABS: TabNavItem<SettingsTab>[] = [
	{ label: "Account", id: "account", href: "/settings/account" },
	{ label: "Permissions", id: "permissions", href: "/settings/permissions" },
	{ label: "Notifications", id: "notifications", href: "/settings/notifications" },
	{ label: "Skills", id: "skills", href: "/settings/skills" },
	{ label: "Privacy", id: "privacy", href: "/settings/privacy" },
];

interface SettingsLayoutProps {
	children: ReactNode;
}

function activeTabFromPath(pathname: string): SettingsTab {
	if (pathname.startsWith("/settings/permissions")) return "permissions";
	if (pathname.startsWith("/settings/notifications")) return "notifications";
	if (pathname.startsWith("/settings/skills")) return "skills";
	if (pathname.startsWith("/settings/privacy")) return "privacy";
	return "account";
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
	const activeTab = activeTabFromPath(usePathname());

	return (
		<PageShell title="Settings">
			<TabNav activeId={activeTab} ariaLabel="Settings sections" className="mb-8" items={TABS} />
			{children}
		</PageShell>
	);
}
