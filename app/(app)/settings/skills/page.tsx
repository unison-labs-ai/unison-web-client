import { Suspense } from "react";
import { SkillsPage } from "@/features/settings/skills-page";

export default function SettingsSkillsPage() {
	return (
		<Suspense>
			<SkillsPage />
		</Suspense>
	);
}
