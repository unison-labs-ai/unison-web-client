import { Suspense } from "react";
import { AccountPage } from "@/features/settings/account-page";

export default function SettingsAccountPage() {
	return (
		<Suspense>
			<AccountPage />
		</Suspense>
	);
}
