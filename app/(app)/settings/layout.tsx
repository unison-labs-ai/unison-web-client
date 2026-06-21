import type { ReactNode } from "react";
import { SettingsLayout } from "@/features/settings/settings-layout";

export default function SettingsSegmentLayout({ children }: { children: ReactNode }) {
	return <SettingsLayout>{children}</SettingsLayout>;
}
