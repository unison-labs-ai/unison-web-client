"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { SessionArtifact } from "@unison/contracts";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DocumentToolbar } from "@/features/documents/document-toolbar";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "@/features/documents/markdown-bridge";
import { WebApiError } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { recordValue, stringListValue, stringValue } from "@/lib/session-transcript";
import { Button } from "@/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/ui/dialog";
import { Skeleton } from "@/ui/skeleton";
import { RecipientsSection } from "../recipient-field";
import type { EmailModule } from "../types";

// ---------------------------------------------------------------------------
// Email module view (plan §9). Until the draft has a durable artifact id it's
// the streamed preview (read-only). Once it does, the live artifact loads and
// becomes editable — subject + recipients + a rich TipTap body — with debounced
// autosave to the artifact payload (PATCH /v1/artifacts/:id, 409-reconciled) so
// edits persist cross-device, plus Open-in-Gmail and a user-initiated Send.
// ---------------------------------------------------------------------------

const AUTOSAVE_DEBOUNCE_MS = 800;

interface EmailFields {
	bcc: string;
	body: string;
	cc: string;
	subject: string;
	to: string;
}

function fieldsFromArtifact(artifact: SessionArtifact): EmailFields {
	const payload = recordValue(artifact.payload);
	return {
		bcc: stringListValue(payload, "bcc").join(", "),
		body: stringValue(payload, "body") ?? "",
		cc: stringListValue(payload, "cc").join(", "),
		subject: stringValue(payload, "subject") ?? "",
		to: stringValue(payload, "to") ?? "",
	};
}

function isSent(artifact: SessionArtifact): boolean {
	return (
		artifact.status === "superseded" ||
		stringValue(recordValue(artifact.payload), "state") === "sent"
	);
}

function splitList(value: string): string[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

/** Open a prefilled Gmail compose window (no Unison send) — the low-effort
 * "edit/send it in Gmail" escape hatch alongside the in-app Send. */
function gmailComposeUrl(fields: EmailFields): string {
	const params = new URLSearchParams({ fs: "1", su: fields.subject, to: fields.to, view: "cm" });
	if (fields.cc) params.set("cc", fields.cc);
	if (fields.bcc) params.set("bcc", fields.bcc);
	if (fields.body) params.set("body", fields.body);
	return `https://mail.google.com/mail/?${params.toString()}`;
}

export function EmailModuleView({ module }: { module: EmailModule }) {
	if (!module.artifactId) {
		return <StreamingEmailPreview module={module} />;
	}

	return (
		<LoadedEmailModule
			artifactId={module.artifactId}
			editSignal={module.callIds.length}
			key={module.artifactId}
		/>
	);
}

function StreamingEmailPreview({ module }: { module: EmailModule }) {
	const { email } = module;
	const recipients = [email.to, ...email.cc, ...email.bcc].filter(Boolean);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			<h2 className="mb-3 text-[15px] font-medium text-ink">{email.subject || "(no subject)"}</h2>
			{recipients.length > 0 ? (
				<div className="mb-4 text-sm text-ink-subtle">To: {recipients.join(", ")}</div>
			) : null}
			<div className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">
				{email.body || "Writing email…"}
			</div>
		</div>
	);
}

function LoadedEmailModule({ artifactId, editSignal }: { artifactId: string; editSignal: number }) {
	const api = useApi();
	const queryClient = useQueryClient();

	const artifactQuery = useQuery({
		queryFn: () => api.getArtifact(artifactId).then((response) => response.artifact),
		queryKey: ["artifact", artifactId],
		staleTime: 5_000,
	});

	// A new agent edit (another call id) changed the draft server-side — refetch.
	// biome-ignore lint/correctness/useExhaustiveDependencies: editSignal is the intended re-trigger
	useEffect(() => {
		void queryClient.invalidateQueries({ queryKey: ["artifact", artifactId] });
	}, [editSignal, artifactId, queryClient]);

	if (artifactQuery.isLoading || !artifactQuery.data) {
		if (artifactQuery.isError) {
			return <div className="flex-1 px-5 py-4 text-sm text-danger">Failed to load this draft.</div>;
		}

		return (
			<div className="flex flex-col gap-3 px-5 py-4">
				<Skeleton style={{ height: "28px", width: "100%" }} />
				<Skeleton style={{ height: "200px", width: "100%" }} />
			</div>
		);
	}

	if (isSent(artifactQuery.data)) {
		return <SentEmailView artifact={artifactQuery.data} />;
	}

	return <EmailEditor artifact={artifactQuery.data} key={artifactId} />;
}

function SentEmailView({ artifact }: { artifact: SessionArtifact }) {
	const fields = fieldsFromArtifact(artifact);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			<span className="bg-positive-soft text-positive mb-3 inline-block rounded-pill px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
				Sent
			</span>
			<h2 className="mb-2 text-[15px] font-medium text-ink">{fields.subject || "(no subject)"}</h2>
			<div className="mb-4 flex flex-col gap-0.5 text-sm text-ink-subtle">
				{fields.to ? <span>To: {fields.to}</span> : null}
				{fields.cc ? <span>Cc: {fields.cc}</span> : null}
			</div>
			<div className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{fields.body}</div>
		</div>
	);
}

function EmailEditor({ artifact }: { artifact: SessionArtifact }) {
	const api = useApi();
	const queryClient = useQueryClient();

	const [fields, setFields] = useState<EmailFields>(() => fieldsFromArtifact(artifact));
	const [confirmOpen, setConfirmOpen] = useState(false);

	const baseUpdatedAtRef = useRef(artifact.updatedAt);
	const lastSavedRef = useRef<string | null>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savingRef = useRef(false);
	const fieldsRef = useRef(fields);
	fieldsRef.current = fields;
	const persistRef = useRef<() => void>(() => {});

	const scheduleSave = useCallback(() => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null;
			persistRef.current();
		}, AUTOSAVE_DEBOUNCE_MS);
	}, []);

	const editor = useEditor({
		content: markdownToEditorHtml(fields.body),
		extensions: [StarterKit],
		immediatelyRender: false,
		onCreate: ({ editor: created }) => {
			lastSavedRef.current = serialize({
				...fieldsRef.current,
				body: editorHtmlToMarkdown(created.getHTML()),
			});
		},
		onUpdate: () => scheduleSave(),
	});

	const currentBody = useCallback(
		() =>
			editor && !editor.isDestroyed
				? editorHtmlToMarkdown(editor.getHTML())
				: fieldsRef.current.body,
		[editor],
	);

	const persist = useCallback(async () => {
		if (savingRef.current) {
			return;
		}

		const snapshot = { ...fieldsRef.current, body: currentBody() };
		const serialized = serialize(snapshot);

		if (serialized === lastSavedRef.current) {
			return;
		}

		savingRef.current = true;

		try {
			const updated = await api.updateArtifact(artifact.id, {
				baseUpdatedAt: baseUpdatedAtRef.current,
				bcc: splitList(snapshot.bcc),
				body: snapshot.body,
				cc: splitList(snapshot.cc),
				subject: snapshot.subject,
				to: snapshot.to,
			});

			baseUpdatedAtRef.current = updated.updatedAt;
			lastSavedRef.current = serialized;
			void queryClient.invalidateQueries({ queryKey: ["thread", artifact.sessionId, "artifacts"] });
		} catch (error) {
			if (error instanceof WebApiError && error.status === 409) {
				const fresh = await api
					.getArtifact(artifact.id)
					.then((r) => r.artifact)
					.catch(() => null);

				if (fresh && editor && !editor.isDestroyed) {
					const freshFields = fieldsFromArtifact(fresh);
					setFields(freshFields);
					editor.commands.setContent(markdownToEditorHtml(freshFields.body));
					baseUpdatedAtRef.current = fresh.updatedAt;
					lastSavedRef.current = serialize(freshFields);
				}

				toast.error("This draft was updated elsewhere — reloaded the latest version.");
			} else {
				toast.error(error instanceof Error ? error.message : "Couldn't save the draft.");
			}
		} finally {
			savingRef.current = false;

			if (serialize({ ...fieldsRef.current, body: currentBody() }) !== lastSavedRef.current) {
				scheduleSave();
			}
		}
	}, [api, artifact.id, artifact.sessionId, currentBody, editor, queryClient, scheduleSave]);

	useEffect(() => {
		persistRef.current = () => void persist();
	}, [persist]);

	// Flush a pending save on unmount (tab switch / panel close).
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
				persistRef.current();
			}
		};
	}, []);

	const sendMutation = useMutation({
		mutationFn: () => api.sendArtifactEmail(artifact.id),
		onError: (error) => {
			if (error instanceof WebApiError && error.code === "google_not_connected") {
				toast.error("Connect Google to send email.", {
					action: { label: "Connections", onClick: () => window.location.assign("/connections") },
				});
				return;
			}
			if (error instanceof WebApiError && error.code === "google_scope_missing") {
				toast.error("Gmail send permission is missing — reconnect Google.", {
					action: { label: "Connections", onClick: () => window.location.assign("/connections") },
				});
				return;
			}
			toast.error(error instanceof Error ? error.message : "Couldn't send the email.");
		},
		onSuccess: (result) => {
			setConfirmOpen(false);
			toast.success("Email sent");
			queryClient.setQueryData(["artifact", artifact.id], result.artifact);
			void queryClient.invalidateQueries({ queryKey: ["thread", artifact.sessionId, "artifacts"] });
		},
	});

	function updateField(key: keyof EmailFields, value: string) {
		setFields((prev) => ({ ...prev, [key]: value }));
		scheduleSave();
	}

	const hasRecipients =
		fields.to.trim().length > 0 || fields.cc.trim().length > 0 || fields.bcc.trim().length > 0;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* Subject (the title) + recipients — roomy, no per-row dividers. */}
			<div className="shrink-0 px-5 pt-4 pb-3">
				<input
					className="w-full border-none bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-subtle"
					onChange={(event) => updateField("subject", event.target.value)}
					placeholder="Subject"
					value={fields.subject}
				/>
				<div className="mt-2">
					<RecipientsSection
						bcc={fields.bcc}
						cc={fields.cc}
						onChange={updateField}
						to={fields.to}
					/>
				</div>
			</div>

			{/* Formatting toolbar */}
			{editor && (
				<div className="flex shrink-0 items-center border-y border-(--line) px-3 py-1.5">
					<DocumentToolbar editor={editor} />
				</div>
			)}

			{/* Body */}
			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				<EditorContent className="doc-editor" editor={editor} />
			</div>

			{/* Footer — Open in Gmail (escape hatch) + Send (real send) */}
			<div className="flex shrink-0 items-center justify-between gap-2 border-t border-(--border) px-4 py-3">
				<div className="flex items-center gap-1">
					<Button asChild size="sm" variant="secondary">
						<a href={gmailComposeUrl(fields)} rel="noreferrer" target="_blank">
							<ExternalLink size={14} />
							Open in Gmail
						</a>
					</Button>
				</div>
				<div className="flex items-center gap-2">
					<Button
						disabled={!hasRecipients || sendMutation.isPending}
						onClick={() => setConfirmOpen(true)}
						size="sm"
					>
						{sendMutation.isPending ? (
							<Loader2 className="animate-spin" size={14} />
						) : (
							<Send size={14} />
						)}
						Send
					</Button>
				</div>
			</div>

			<Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Send this email?</DialogTitle>
						<DialogDescription>
							It will be sent from your connected Google account to{" "}
							{[fields.to, fields.cc, fields.bcc].filter(Boolean).join(", ") || "the recipients"}.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={() => setConfirmOpen(false)} variant="ghost">
							Cancel
						</Button>
						<Button disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
							{sendMutation.isPending ? (
								<Loader2 className="animate-spin" size={14} />
							) : (
								<Send size={14} />
							)}
							Send email
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function serialize(fields: EmailFields): string {
	return JSON.stringify([fields.to, fields.cc, fields.bcc, fields.subject, fields.body]);
}
