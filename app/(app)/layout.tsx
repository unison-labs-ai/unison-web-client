import type { ReactNode } from "react";

import { GoogleConnectGate } from "@/features/auth/google-connect-gate";
import { AppShell } from "@/features/shell/app-shell";
import { Toaster } from "@/ui/sonner";

export default function AppLayout({ children }: { children: ReactNode }) {
	// Every authenticated surface sits behind the Google workspace floor: a
	// fresh web account is signed in via Google *identity* only, so we require
	// the workspace connection before the app is usable (mobile enforces the
	// same via its native sign-in consent).
	return (
		<GoogleConnectGate>
			<AppShell>
				{children}
				<Toaster />
			</AppShell>
		</GoogleConnectGate>
	);
}
