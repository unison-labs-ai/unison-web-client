import { Suspense } from "react";
import { PermissionsPage } from "@/features/settings/permissions-page";

export default function SettingsPermissionsPage() {
	return (
		<Suspense>
			<PermissionsPage />
		</Suspense>
	);
}
