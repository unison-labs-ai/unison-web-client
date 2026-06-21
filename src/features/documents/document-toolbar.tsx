"use client";

import type { Editor } from "@tiptap/react";
import {
	Bold,
	Braces,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	List,
	ListOrdered,
	Minus,
	Quote,
	Redo2,
	Strikethrough,
	Undo2,
} from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/ui/utils";

// ---------------------------------------------------------------------------
// The document formatting toolbar (plan M0). Shared by the full-page editor and
// the session document module so both expose the same StarterKit commands.
// ---------------------------------------------------------------------------

function ToolbarButton({
	active,
	disabled,
	icon: Icon,
	label,
	onRun,
}: {
	active?: boolean;
	disabled?: boolean;
	icon: ComponentType<{ size?: number | string }>;
	label: string;
	onRun: () => void;
}) {
	return (
		<button
			aria-label={label}
			aria-pressed={active}
			className={cn(
				"flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-ink-subtle transition-colors hover:bg-primary-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40",
				active && "bg-primary-soft text-ink",
			)}
			disabled={disabled}
			// Keep the editor selection: the command runs without the button
			// stealing focus first.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onRun}
			title={label}
			type="button"
		>
			<Icon size={15} />
		</button>
	);
}

function ToolbarDivider() {
	return <span aria-hidden className="mx-1 h-4 w-px bg-(--line)" />;
}

/** The StarterKit formatting controls for a TipTap editor (null until mounted). */
export function DocumentToolbar({ editor }: { editor: Editor | null }) {
	if (!editor) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-0.5">
			<ToolbarButton
				active={editor.isActive("heading", { level: 1 })}
				icon={Heading1}
				label="Heading 1"
				onRun={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
			/>
			<ToolbarButton
				active={editor.isActive("heading", { level: 2 })}
				icon={Heading2}
				label="Heading 2"
				onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
			/>
			<ToolbarButton
				active={editor.isActive("heading", { level: 3 })}
				icon={Heading3}
				label="Heading 3"
				onRun={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
			/>
			<ToolbarDivider />
			<ToolbarButton
				active={editor.isActive("bold")}
				icon={Bold}
				label="Bold"
				onRun={() => editor.chain().focus().toggleBold().run()}
			/>
			<ToolbarButton
				active={editor.isActive("italic")}
				icon={Italic}
				label="Italic"
				onRun={() => editor.chain().focus().toggleItalic().run()}
			/>
			<ToolbarButton
				active={editor.isActive("strike")}
				icon={Strikethrough}
				label="Strikethrough"
				onRun={() => editor.chain().focus().toggleStrike().run()}
			/>
			<ToolbarButton
				active={editor.isActive("code")}
				icon={Code}
				label="Inline code"
				onRun={() => editor.chain().focus().toggleCode().run()}
			/>
			<ToolbarDivider />
			<ToolbarButton
				active={editor.isActive("bulletList")}
				icon={List}
				label="Bullet list"
				onRun={() => editor.chain().focus().toggleBulletList().run()}
			/>
			<ToolbarButton
				active={editor.isActive("orderedList")}
				icon={ListOrdered}
				label="Numbered list"
				onRun={() => editor.chain().focus().toggleOrderedList().run()}
			/>
			<ToolbarButton
				active={editor.isActive("blockquote")}
				icon={Quote}
				label="Quote"
				onRun={() => editor.chain().focus().toggleBlockquote().run()}
			/>
			<ToolbarButton
				active={editor.isActive("codeBlock")}
				icon={Braces}
				label="Code block"
				onRun={() => editor.chain().focus().toggleCodeBlock().run()}
			/>
			<ToolbarButton
				icon={Minus}
				label="Divider"
				onRun={() => editor.chain().focus().setHorizontalRule().run()}
			/>
			<ToolbarDivider />
			<ToolbarButton
				disabled={!editor.can().undo()}
				icon={Undo2}
				label="Undo"
				onRun={() => editor.chain().focus().undo().run()}
			/>
			<ToolbarButton
				disabled={!editor.can().redo()}
				icon={Redo2}
				label="Redo"
				onRun={() => editor.chain().focus().redo().run()}
			/>
		</div>
	);
}
