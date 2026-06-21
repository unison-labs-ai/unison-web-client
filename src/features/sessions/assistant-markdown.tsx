import type { ReactNode } from "react";

type InlineSpan = {
	bold?: boolean;
	code?: boolean;
	href?: string;
	italic?: boolean;
	math?: boolean;
	text: string;
};

const INLINE_PATTERNS: { make: (match: RegExpMatchArray) => InlineSpan; re: RegExp }[] = [
	{ make: (m) => ({ href: m[2] ?? "", text: m[1] ?? "" }), re: /^\[([^\]]+)\]\(([^)\s]+)\)/ },
	{ make: (m) => ({ bold: true, text: m[1] ?? "" }), re: /^\*\*([^*]+)\*\*/ },
	{ make: (m) => ({ bold: true, text: m[1] ?? "" }), re: /^__([^_]+)__/ },
	{ make: (m) => ({ code: true, text: m[1] ?? "" }), re: /^`([^`]+)`/ },
	{ make: (m) => ({ math: true, text: m[1] ?? "" }), re: /^\$(?!\$)(\S(?:[^$\n]*?\S)?)\$(?!\$)/ },
	{ make: (m) => ({ italic: true, text: m[1] ?? "" }), re: /^\*([^*\n]+)\*/ },
	{ make: (m) => ({ italic: true, text: m[1] ?? "" }), re: /^_([^_\n]+)_/ },
];

type Block =
	| { items: string[]; kind: "ordered"; start: number }
	| { items: string[]; kind: "bullet" }
	| { kind: "code"; text: string }
	| { kind: "heading"; level: number; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "quote"; text: string };

function parseInline(input: string): InlineSpan[] {
	const spans: InlineSpan[] = [];
	let buffer = "";
	let index = 0;

	while (index < input.length) {
		const char = input[index];

		if (char === "*" || char === "_" || char === "`" || char === "[" || char === "$") {
			const rest = input.slice(index);
			let matched = false;

			for (const { make, re } of INLINE_PATTERNS) {
				const match = rest.match(re);

				if (match) {
					if (buffer) {
						spans.push({ text: buffer });
						buffer = "";
					}

					spans.push(make(match));
					index += match[0].length;
					matched = true;
					break;
				}
			}

			if (matched) continue;
		}

		buffer += char;
		index += 1;
	}

	if (buffer) {
		spans.push({ text: buffer });
	}

	return spans;
}

function parseBlocks(markdown: string): Block[] {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const blocks: Block[] = [];
	let paragraph: string[] = [];

	const flushParagraph = () => {
		if (paragraph.length > 0) {
			blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
			paragraph = [];
		}
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const trimmed = line.trim();

		if (trimmed.startsWith("```")) {
			flushParagraph();
			const body: string[] = [];
			index += 1;

			while (index < lines.length) {
				const codeLine = lines[index] ?? "";
				if (codeLine.trim().startsWith("```")) break;
				body.push(codeLine);
				index += 1;
			}

			blocks.push({ kind: "code", text: body.join("\n") });
			continue;
		}

		if (trimmed.length === 0) {
			flushParagraph();
			continue;
		}

		const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			flushParagraph();
			blocks.push({
				kind: "heading",
				level: (heading[1] ?? "").length,
				text: heading[2] ?? "",
			});
			continue;
		}

		const quote = trimmed.match(/^>\s?(.*)$/);
		if (quote) {
			flushParagraph();
			const last = blocks[blocks.length - 1];

			if (last?.kind === "quote") {
				last.text = `${last.text} ${quote[1] ?? ""}`;
			} else {
				blocks.push({ kind: "quote", text: quote[1] ?? "" });
			}

			continue;
		}

		const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
		if (bullet) {
			flushParagraph();
			const last = blocks[blocks.length - 1];

			if (last?.kind === "bullet") {
				last.items.push(bullet[1] ?? "");
			} else {
				blocks.push({ items: [bullet[1] ?? ""], kind: "bullet" });
			}

			continue;
		}

		const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
		if (ordered) {
			flushParagraph();
			const last = blocks[blocks.length - 1];

			if (last?.kind === "ordered") {
				last.items.push(ordered[2] ?? "");
			} else {
				blocks.push({
					items: [ordered[2] ?? ""],
					kind: "ordered",
					start: Number(ordered[1] ?? 1),
				});
			}

			continue;
		}

		paragraph.push(trimmed);
	}

	flushParagraph();
	return blocks;
}

function safeHref(href: string): string | null {
	if (/^(https?:|mailto:)/i.test(href)) return href;
	return null;
}

function InlineText({ text }: { text: string }) {
	return parseInline(text).map((span, spanIndex): ReactNode => {
		const key = `${spanIndex}:${span.text}`;
		const className = [
			span.bold ? "font-medium text-ink" : null,
			span.italic ? "italic" : null,
			span.code
				? "rounded-sm bg-surface-muted px-1 py-[1px] font-mono text-[0.92em] text-ink-muted"
				: null,
			span.math ? "font-mono text-[0.95em] text-ink" : null,
			span.href ? "text-sky-foreground underline underline-offset-2" : null,
		]
			.filter(Boolean)
			.join(" ");

		if (span.href) {
			const href = safeHref(span.href);
			if (href) {
				return (
					<a className={className} href={href} key={key} rel="noreferrer" target="_blank">
						{span.text}
					</a>
				);
			}
		}

		return (
			<span className={className || undefined} key={key}>
				{span.text}
			</span>
		);
	});
}

export function AssistantMarkdown({ text }: { text: string }) {
	const trimmed = text.trim();

	if (trimmed.length === 0) return null;

	const blocks = parseBlocks(trimmed);

	return (
		<div className="flex flex-col gap-3 text-ink text-[16px] leading-[1.55]">
			{blocks.map((block, blockIndex) => {
				const key = `${block.kind}:${blockIndex}`;

				if (block.kind === "code") {
					return (
						<pre
							className="overflow-auto rounded-md bg-surface-muted p-3 font-mono text-[13px] text-ink-muted leading-[1.5]"
							key={key}
						>
							{block.text}
						</pre>
					);
				}

				if (block.kind === "heading") {
					const Tag = block.level <= 2 ? "h3" : "h4";
					return (
						<Tag
							className={
								block.level <= 2 ? "m-0 text-[19px] font-medium" : "m-0 text-base font-medium"
							}
							key={key}
						>
							<InlineText text={block.text} />
						</Tag>
					);
				}

				if (block.kind === "quote") {
					return (
						<blockquote
							className="m-0 border-l border-(--border) py-1 pl-3 text-ink-muted"
							key={key}
						>
							<InlineText text={block.text} />
						</blockquote>
					);
				}

				if (block.kind === "bullet" || block.kind === "ordered") {
					const ListTag = block.kind === "ordered" ? "ol" : "ul";
					return (
						<ListTag
							className={block.kind === "ordered" ? "m-0 list-decimal pl-6" : "m-0 list-disc pl-6"}
							key={key}
							start={block.kind === "ordered" ? block.start : undefined}
						>
							{block.items.map((item) => (
								<li className="pl-1" key={`${key}:${item}`}>
									<InlineText text={item} />
								</li>
							))}
						</ListTag>
					);
				}

				return (
					<p className="m-0" key={key}>
						<InlineText text={block.text} />
					</p>
				);
			})}
		</div>
	);
}
