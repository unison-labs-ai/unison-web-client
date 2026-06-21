import type { Reminder } from "@unison/contracts";

export type BadgeVariant = "default" | "positive" | "danger" | "warning" | "sky";

export type ReminderGroup = "overdue" | "upcoming" | "done";

export function getReminderGroup(reminder: Reminder): ReminderGroup {
	if (
		reminder.status === "sent" ||
		reminder.status === "cancelled" ||
		reminder.status === "failed"
	) {
		return "done";
	}
	if (reminder.status === "scheduled") {
		return new Date(reminder.dueAt) < new Date() ? "overdue" : "upcoming";
	}
	// snoozed — treat as upcoming
	return "upcoming";
}

export function reminderBadgeVariant(group: ReminderGroup): BadgeVariant {
	switch (group) {
		case "overdue":
			return "danger";
		case "upcoming":
			return "warning";
		case "done":
			return "positive";
	}
}

export function reminderBadgeLabel(reminder: Reminder, group: ReminderGroup): string {
	if (reminder.status === "sent") return "Done";
	if (reminder.status === "cancelled") return "Cancelled";
	if (reminder.status === "failed") return "Failed";
	if (group === "overdue") return "Overdue";
	return "Upcoming";
}
