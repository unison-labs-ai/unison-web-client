import type { AttachmentCreate } from "@unison/contracts";

import { webEnv } from "@/lib/env";

export const MAX_CHAT_IMAGES = 4;

const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
const MAX_LONG_EDGE = 2048;
const MAX_POST_COMPRESS_BYTES = 10 * 1024 * 1024;
const MAX_PRE_COMPRESS_BYTES = 25 * 1024 * 1024;
const SUPPORTED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type NormalizedImageAttachment = {
	blob: Blob;
	height: number | null;
	mimeType: "image/jpeg";
	previewUrl: string;
	sizeBytes: number;
	width: number | null;
};

export type ChatAttachmentDraft = {
	error?: string;
	height: number | null;
	localId: string;
	mimeType: "image/jpeg";
	previewUrl: string;
	progress: number;
	sizeBytes: number;
	status: "failed" | "preparing" | "uploaded" | "uploading";
	storagePath?: string;
	width: number | null;
};

type LoadedImage = {
	cleanup: () => void;
	height: number;
	source: CanvasImageSource;
	width: number;
};

export function createLocalAttachmentId(): string {
	return crypto.randomUUID();
}

export function uploadedAttachmentCreate(attachment: ChatAttachmentDraft): AttachmentCreate | null {
	if (attachment.status !== "uploaded" || !attachment.storagePath) {
		return null;
	}

	return {
		height: attachment.height,
		kind: "image",
		mimeType: attachment.mimeType,
		sizeBytes: attachment.sizeBytes,
		storagePath: attachment.storagePath,
		width: attachment.width,
	};
}

function positiveDimension(value: number): number | null {
	return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function resizedDimensions(width: number, height: number): { height: number; width: number } {
	if (width <= 0 || height <= 0 || Math.max(width, height) <= MAX_LONG_EDGE) {
		return { height, width };
	}

	const scale = MAX_LONG_EDGE / Math.max(width, height);

	return {
		height: Math.round(height * scale),
		width: Math.round(width * scale),
	};
}

async function loadImage(file: File): Promise<LoadedImage> {
	if ("createImageBitmap" in window) {
		const bitmap = await createImageBitmap(file);

		return {
			cleanup: () => bitmap.close(),
			height: bitmap.height,
			source: bitmap,
			width: bitmap.width,
		};
	}

	const previewUrl = URL.createObjectURL(file);

	return new Promise((resolve, reject) => {
		const image = new Image();

		image.onload = () => {
			resolve({
				cleanup: () => URL.revokeObjectURL(previewUrl),
				height: image.naturalHeight,
				source: image,
				width: image.naturalWidth,
			});
		};
		image.onerror = () => {
			URL.revokeObjectURL(previewUrl);
			reject(new Error("Could not read that image."));
		};
		image.src = previewUrl;
	});
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("Could not prepare that image."));
					return;
				}
				resolve(blob);
			},
			"image/jpeg",
			0.84,
		);
	});
}

export async function normalizeImage(file: File): Promise<NormalizedImageAttachment> {
	if (!SUPPORTED_INPUT_TYPES.has(file.type)) {
		throw new Error("Choose a JPEG, PNG, or WebP image.");
	}

	if (file.size > MAX_PRE_COMPRESS_BYTES) {
		throw new Error("Choose an image smaller than 25MB.");
	}

	const loaded = await loadImage(file);

	try {
		const dimensions = resizedDimensions(loaded.width, loaded.height);
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");

		if (!context) {
			throw new Error("Image processing is not available in this browser.");
		}

		canvas.width = dimensions.width;
		canvas.height = dimensions.height;
		context.drawImage(loaded.source, 0, 0, dimensions.width, dimensions.height);

		const blob = await canvasToBlob(canvas);

		if (blob.size > MAX_POST_COMPRESS_BYTES) {
			throw new Error("The compressed image is still larger than 10MB.");
		}

		return {
			blob,
			height: positiveDimension(dimensions.height),
			mimeType: "image/jpeg",
			previewUrl: URL.createObjectURL(blob),
			sizeBytes: blob.size,
			width: positiveDimension(dimensions.width),
		};
	} finally {
		loaded.cleanup();
	}
}

function storageObjectUrl(storagePath: string): string {
	if (!webEnv.supabaseUrl) {
		throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for image uploads.");
	}

	const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");

	return `${webEnv.supabaseUrl}/storage/v1/object/${CHAT_ATTACHMENTS_BUCKET}/${encodedPath}`;
}

function storageHeaders(accessToken: string, contentType?: string): Record<string, string> {
	return {
		...(webEnv.supabasePublishableKey ? { apikey: webEnv.supabasePublishableKey } : {}),
		authorization: `Bearer ${accessToken}`,
		...(contentType ? { "content-type": contentType } : {}),
	};
}

export async function uploadToStorage(
	attachment: NormalizedImageAttachment,
	input: {
		accessToken: string;
		threadId: string;
		userId: string;
	},
): Promise<string> {
	const storagePath = `${input.userId}/${input.threadId}/${crypto.randomUUID()}.jpg`;
	const response = await fetch(storageObjectUrl(storagePath), {
		body: attachment.blob,
		headers: {
			...storageHeaders(input.accessToken, "image/jpeg"),
			"x-upsert": "false",
		},
		method: "POST",
	});

	if (!response.ok) {
		const message = await response.text().catch(() => "");
		throw new Error(message || `Image upload failed with status ${response.status}.`);
	}

	return storagePath;
}

export async function deleteStorageObject(input: {
	accessToken: string;
	storagePath: string;
}): Promise<void> {
	const response = await fetch(storageObjectUrl(input.storagePath), {
		headers: storageHeaders(input.accessToken),
		method: "DELETE",
	});

	if (!response.ok) {
		throw new Error(`Image cleanup failed with status ${response.status}.`);
	}
}
