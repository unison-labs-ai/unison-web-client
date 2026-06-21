import { Suspense } from "react";
import { RemindersPage } from "@/features/reminders/reminders-page";

export default function Reminders() {
	return (
		<Suspense>
			<RemindersPage />
		</Suspense>
	);
}
