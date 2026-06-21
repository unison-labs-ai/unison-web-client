import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AssistantMarkdown } from "./assistant-markdown";

describe("AssistantMarkdown", () => {
	it("renders inline dollar math without leaking delimiters", () => {
		const markup = renderToStaticMarkup(
			<AssistantMarkdown text="The square root of 60 is approximately 7.75 (or exactly $7.74596669...$)." />,
		);

		expect(markup).toContain("7.74596669...");
		expect(markup).not.toContain("$7.74596669...$");
	});

	it("leaves unmatched dollar text literal", () => {
		const markup = renderToStaticMarkup(
			<AssistantMarkdown text="The estimate is about $7 today." />,
		);

		expect(markup).toContain("about $7 today");
	});
});
