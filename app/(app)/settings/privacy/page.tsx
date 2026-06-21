import { Suspense } from "react";
import { PrivacyPage } from "@/features/settings/privacy-page";

export default function SettingsPrivacyPage() {
	return (
		<Suspense>
			<PrivacyPage />
		</Suspense>
	);
}
