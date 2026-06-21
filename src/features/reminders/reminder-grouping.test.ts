import { describe, expect, it } from "bun:test";
import { type Reminder, reminderSchema } from "@unison/contracts";

import { getReminderGroup, reminderBadgeLabel, reminderBadgeVariant } from "./reminder-grouping";

const PAST_ISO = "2000-01-01T00:00:00.000Z";
const FUTURE_ISO = "2999-01-01T00:00:00.000Z";

function reminder(overrides: Partial<Reminder>): Reminder {
	return reminderSchema.parse({
		body: null,
		captureId: null,
		createdAt: PAST_ISO,
		dueAt: FUTURE_ISO,
		id: "00000000-0000-4000-8000-000000000001",
		metadata: {},
		snoozedUntil: null,
		sourceEventId: null,
		status: "scheduled",
		tenantId: "00000000-0000-4000-8000-000000000002",
		timezone: null,
		title: "Pay rent",
		updatedAt: PAST_ISO,
		userId: "00000000-0000-4000-8000-000000000003",
		...overrides,
	});
}

describe("reminder grouping", () => {
	it("splits scheduled reminders into overdue and upcoming by due date", () => {
		expect(getReminderGroup(reminder({ dueAt: PAST_ISO, status: "scheduled" }))).toBe("overdue");
		expect(getReminderGroup(reminder({ dueAt: FUTURE_ISO, status: "scheduled" }))).toBe("upcoming");
	});

	it("treats snoozed reminders as upcoming even when the due date passed", () => {
		expect(getReminderGroup(reminder({ dueAt: PAST_ISO, status: "snoozed" }))).toBe("upcoming");
	});

	it("groups sent, cancelled, and failed reminders as done", () => {
		expect(getReminderGroup(reminder({ status: "sent" }))).toBe("done");
		expect(getReminderGroup(reminder({ status: "cancelled" }))).toBe("done");
		expect(getReminderGroup(reminder({ status: "failed" }))).toBe("done");
	});

	it("labels badges by terminal status before group", () => {
		expect(reminderBadgeLabel(reminder({ status: "sent" }), "done")).toBe("Done");
		expect(reminderBadgeLabel(reminder({ status: "cancelled" }), "done")).toBe("Cancelled");
		expect(reminderBadgeLabel(reminder({ status: "failed" }), "done")).toBe("Failed");
		expect(reminderBadgeLabel(reminder({ dueAt: PAST_ISO }), "overdue")).toBe("Overdue");
		expect(reminderBadgeLabel(reminder({ dueAt: FUTURE_ISO }), "upcoming")).toBe("Upcoming");
	});

	it("maps groups to badge variants", () => {
		expect(reminderBadgeVariant("overdue")).toBe("danger");
		expect(reminderBadgeVariant("upcoming")).toBe("warning");
		expect(reminderBadgeVariant("done")).toBe("positive");
	});
});
