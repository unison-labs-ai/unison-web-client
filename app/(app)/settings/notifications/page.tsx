import { Suspense } from "react";
import { NotificationsSettingsPage } from "@/features/settings/notifications-settings-page";

export default function SettingsNotificationsPage() {
	return (
		<Suspense>
			<NotificationsSettingsPage />
		</Suspense>
	);
}
