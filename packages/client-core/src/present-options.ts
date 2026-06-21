// present_options is an agent tool that renders a small set of selectable
// options in chat (e.g. "Run now" / "Not now"). Both clients parse the tool
// call's input into this card model and, when the user taps an option, send its
// label back as the next user message. Shared so web + mobile agree on shape.

export type PresentOption = {
	description?: string;
	id: string;
	label: string;
	variant?: string;
};

export type PresentOptions = {
	options: PresentOption[];
	title: string;
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function trimmedString(record: Record<string, unknown>, key: string): string | null {
	const value = record[key];
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Parse a present_options tool call's input into a renderable card model, or
 * null when it's malformed (no title, or no options with labels). */
export function parsePresentOptions(input: unknown): PresentOptions | null {
	const record = asRecord(input);
	const title = trimmedString(record, "title");
	const rawOptions = Array.isArray(record.options) ? record.options : [];
	const options: PresentOption[] = [];
	for (const raw of rawOptions) {
		const optionRecord = asRecord(raw);
		const label = trimmedString(optionRecord, "label");
		if (!label) {
			continue;
		}
		options.push({
			description: trimmedString(optionRecord, "description") ?? undefined,
			id: trimmedString(optionRecord, "id") ?? label,
			label,
			variant: trimmedString(optionRecord, "variant") ?? undefined,
		});
	}
	if (!title || options.length === 0) {
		return null;
	}
	return { options, title };
}
