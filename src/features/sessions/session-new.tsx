"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";

/** Blank pre-thread composer: admit a turn, land on the session (routes §2). */
export function SessionNew() {
	const api = useApi();
	const router = useRouter();
	const [value, setValue] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit() {
		const text = value.trim();
		if (!text || submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			const res = await api.admitThreadMessage({ attachments: [], content: text });
			router.push(`/sessions/${res.thread.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setSubmitting(false);
		}
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void handleSubmit();
		}
	}

	return (
		<div
			style={{
				alignItems: "center",
				display: "flex",
				justifyContent: "center",
				minHeight: "60vh",
				padding: "40px 24px",
			}}
		>
			<div style={{ maxWidth: "600px", width: "100%" }}>
				<h1 className="type-h3" style={{ color: "var(--ink)", marginBottom: "24px", marginTop: 0 }}>
					New session
				</h1>
				{/* Composer panel — layer-1 recipe (layout.md §2) */}
				<div
					style={{
						background: "var(--surface-muted)",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius-lg)",
						padding: "14px 14px 10px",
					}}
				>
					<textarea
						disabled={submitting}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Ask anything, start a task…"
						rows={4}
						style={{
							background: "transparent",
							border: "none",
							color: "var(--ink)",
							fontSize: "16px",
							lineHeight: "1.6",
							outline: "none",
							padding: 0,
							resize: "none",
							width: "100%",
						}}
						value={value}
					/>
					{error && (
						<p className="type-extrasmall" style={{ color: "var(--danger)", marginTop: "4px" }}>
							{error}
						</p>
					)}
					<div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
						<Button
							aria-label="Start session"
							disabled={!value.trim() || submitting}
							onClick={() => void handleSubmit()}
							size="icon"
							style={{ borderRadius: "50%", height: "34px", width: "34px" }}
						>
							{submitting ? <Loader2 className="animate-spin" size={15} /> : <ArrowUp size={15} />}
						</Button>
					</div>
				</div>
				<p className="type-extrasmall" style={{ color: "var(--ink-subtle)", marginTop: "8px" }}>
					Enter to send · Shift+Enter for newline
				</p>
			</div>
		</div>
	);
}
