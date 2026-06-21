"use client";

import { parsePresentOptions } from "@unison/client-core";
import { useState } from "react";

import type { ToolPart } from "@/lib/session-transcript";
import { Button } from "@/ui/button";

// Renders a present_options tool call as tappable buttons (e.g. Run now / Not
// now). Selecting one sends its label back as the user's next message — our own
// chat-block component, styled like the rest of the transcript.
export function PresentOptionsCard({
	onSelect,
	toolPart,
}: {
	onSelect: (label: string) => void;
	toolPart: ToolPart;
}) {
	const [chosen, setChosen] = useState<string | null>(null);
	const parsed = parsePresentOptions(toolPart.input);
	if (!parsed) {
		return null;
	}

	return (
		<div className="rounded-lg border border-(--line) bg-surface-muted p-3">
			<p className="mb-2 text-sm font-medium text-ink">{parsed.title}</p>
			<div className="flex flex-wrap gap-2">
				{parsed.options.map((option) => (
					<Button
						disabled={chosen !== null}
						key={option.id}
						onClick={() => {
							setChosen(option.id);
							onSelect(option.label);
						}}
						size="sm"
						variant={option.variant === "primary" ? "default" : "secondary"}
					>
						{option.label}
					</Button>
				))}
			</div>
		</div>
	);
}
