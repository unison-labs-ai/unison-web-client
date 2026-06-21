"use client";

import type { AttachmentCreate } from "@unison/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

import { useApi } from "@/lib/api-context";
import {
	type ChatAttachmentDraft,
	createLocalAttachmentId,
	deleteStorageObject,
	MAX_CHAT_IMAGES,
	normalizeImage,
	uploadedAttachmentCreate,
	uploadToStorage,
} from "./attachments";

type ThreadTarget = {
	id: string;
};

type UseImageAttachmentsOptions = {
	disabled?: boolean;
	ensureThread: (draftTitle: string) => Promise<ThreadTarget>;
	getDraftTitle: () => string;
	onError: (message: string | null) => void;
};

export function useImageAttachments({
	disabled,
	ensureThread,
	getDraftTitle,
	onError,
}: UseImageAttachmentsOptions) {
	const api = useApi();
	const [attachments, setAttachments] = useState<ChatAttachmentDraft[]>([]);
	const attachmentsRef = useRef<ChatAttachmentDraft[]>([]);

	useEffect(() => {
		attachmentsRef.current = attachments;
	}, [attachments]);

	useEffect(() => {
		return () => {
			for (const attachment of attachmentsRef.current) {
				URL.revokeObjectURL(attachment.previewUrl);
			}
		};
	}, []);

	const attachmentPayload = useMemo(
		() =>
			attachments
				.map(uploadedAttachmentCreate)
				.filter((attachment): attachment is AttachmentCreate => attachment !== null),
		[attachments],
	);
	const hasPendingAttachments = attachments.some((attachment) => attachment.status !== "uploaded");
	const canAddMore = attachments.length < MAX_CHAT_IMAGES;

	function updateAttachment(localId: string, patch: Partial<ChatAttachmentDraft>) {
		setAttachments((current) =>
			current.map((attachment) =>
				attachment.localId === localId ? { ...attachment, ...patch } : attachment,
			),
		);
	}

	async function addFiles(fileList: FileList | null) {
		if (disabled || !fileList || fileList.length === 0) {
			return;
		}

		const remaining = MAX_CHAT_IMAGES - attachmentsRef.current.length;

		if (remaining <= 0) {
			onError(`You can attach up to ${MAX_CHAT_IMAGES} images.`);
			return;
		}

		const files = Array.from(fileList).slice(0, remaining);

		if (fileList.length > remaining) {
			onError(`You can attach up to ${MAX_CHAT_IMAGES} images.`);
		} else {
			onError(null);
		}

		try {
			const [accessToken, me, thread] = await Promise.all([
				api.getAccessToken(),
				api.getMe(),
				ensureThread(getDraftTitle().trim() || "Photo"),
			]);

			for (const file of files) {
				const localId = createLocalAttachmentId();
				const initialPreviewUrl = URL.createObjectURL(file);

				setAttachments((current) =>
					current.length >= MAX_CHAT_IMAGES
						? current
						: [
								...current,
								{
									height: null,
									localId,
									mimeType: "image/jpeg",
									previewUrl: initialPreviewUrl,
									progress: 0,
									sizeBytes: file.size,
									status: "preparing",
									width: null,
								},
							],
				);

				try {
					const normalized = await normalizeImage(file);

					URL.revokeObjectURL(initialPreviewUrl);
					updateAttachment(localId, {
						height: normalized.height,
						mimeType: normalized.mimeType,
						previewUrl: normalized.previewUrl,
						progress: 0,
						sizeBytes: normalized.sizeBytes,
						status: "uploading",
						width: normalized.width,
					});

					const storagePath = await uploadToStorage(normalized, {
						accessToken,
						threadId: thread.id,
						userId: me.auth.userId,
					});

					updateAttachment(localId, {
						progress: 1,
						status: "uploaded",
						storagePath,
					});
				} catch (attachmentError) {
					updateAttachment(localId, {
						error:
							attachmentError instanceof Error ? attachmentError.message : String(attachmentError),
						progress: 0,
						status: "failed",
					});
				}
			}
		} catch (uploadError) {
			onError(uploadError instanceof Error ? uploadError.message : String(uploadError));
		}
	}

	function removeAttachment(localId: string) {
		setAttachments((current) => {
			const target = current.find((attachment) => attachment.localId === localId);

			if (target) {
				URL.revokeObjectURL(target.previewUrl);
			}
			if (target?.storagePath) {
				void api
					.getAccessToken()
					.then((accessToken) =>
						deleteStorageObject({
							accessToken,
							storagePath: target.storagePath ?? "",
						}),
					)
					.catch(() => undefined);
			}

			return current.filter((attachment) => attachment.localId !== localId);
		});
	}

	function clearAttachments() {
		setAttachments((current) => {
			for (const attachment of current) {
				URL.revokeObjectURL(attachment.previewUrl);
			}

			return [];
		});
	}

	return {
		addFiles,
		attachmentPayload,
		attachments,
		canAddMore,
		clearAttachments,
		hasPendingAttachments,
		removeAttachment,
	};
}
