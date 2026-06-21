import type { NotificationIntent, NotificationTarget } from "@unison/contracts";

/** Where a notification leads — the session it came from, or the reminders list. */
export function notificationTargetHref(target: NotificationTarget): string {
	switch (target.kind) {
		case "session":
			return `/sessions/${target.sessionId}`;
		case "reminder":
			return "/reminders";
		case "artifact":
			return `/sessions/${target.sessionId}`;
	}
}

export function visibleNotifications(notifications: NotificationIntent[]): NotificationIntent[] {
	return notifications.filter((notification) => notification.status !== "suppressed");
}
