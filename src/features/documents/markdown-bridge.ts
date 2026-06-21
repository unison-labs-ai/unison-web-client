import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/**
 * The markdown ↔ editor bridge. Markdown is canonical (the agent patches it,
 * exports convert from it); TipTap edits rich text. Load: markdown → HTML →
 * ProseMirror. Save: editor HTML → markdown via turndown. The round trip
 * normalizes some syntax (emphasis markers, bullet style) — saves are diffed
 * against the last *serialized* markdown so normalization alone never writes.
 */

const turndown = new TurndownService({
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	emDelimiter: "_",
	headingStyle: "atx",
	hr: "---",
});

turndown.use(gfm);

export function markdownToEditorHtml(markdown: string): string {
	return marked.parse(markdown, { async: false, breaks: false, gfm: true }) as string;
}

export function editorHtmlToMarkdown(html: string): string {
	return turndown.turndown(html);
}
