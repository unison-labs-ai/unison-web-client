"use client";

import { Loader2, X } from "lucide-react";

import type { ChatAttachmentDraft } from "./attachments";

export function AttachmentStrip({
	attachments,
	onRemove,
}: {
	attachments: ChatAttachmentDraft[];
	onRemove: (localId: string) => void;
}) {
	if (attachments.length === 0) {
		return null;
	}

	return (
		<div
			style={{
				display: "flex",
				gap: "8px",
				overflowX: "auto",
				padding: "2px 0 10px",
			}}
		>
			{attachments.map((attachment) => (
				<div
					key={attachment.localId}
					style={{
						border: "1px solid var(--border)",
						borderRadius: "var(--radius-lg)",
						flexShrink: 0,
						height: "74px",
						overflow: "hidden",
						position: "relative",
						width: "74px",
					}}
				>
					{/* biome-ignore lint/performance/noImgElement: local object URLs are not useful with next/image. */}
					<img
						alt="Selected attachment"
						src={attachment.previewUrl}
						style={{
							display: "block",
							height: "100%",
							objectFit: "cover",
							width: "100%",
						}}
					/>
					{attachment.status === "preparing" || attachment.status === "uploading" ? (
						<div
							style={{
								alignItems: "center",
								background: "rgba(21, 22, 19, 0.68)",
								display: "flex",
								flexDirection: "column",
								gap: "4px",
								inset: 0,
								justifyContent: "center",
								position: "absolute",
							}}
						>
							<Loader2 className="animate-spin" size={15} />
							<span className="type-extrasmall" style={{ color: "var(--ink)" }}>
								{attachment.status === "uploading" ? "Uploading" : "Preparing"}
							</span>
						</div>
					) : null}
					{attachment.status === "failed" ? (
						<div
							style={{
								alignItems: "center",
								background: "rgba(224, 121, 106, 0.82)",
								display: "flex",
								inset: 0,
								justifyContent: "center",
								padding: "6px",
								position: "absolute",
								textAlign: "center",
							}}
						>
							<span className="type-extrasmall" style={{ color: "var(--ink)" }}>
								{attachment.error ?? "Upload failed"}
							</span>
						</div>
					) : null}
					<button
						aria-label="Remove attachment"
						onClick={() => onRemove(attachment.localId)}
						style={{
							alignItems: "center",
							background: "var(--primary)",
							border: "none",
							borderRadius: "50%",
							color: "var(--primary-foreground)",
							display: "flex",
							height: "22px",
							justifyContent: "center",
							padding: 0,
							position: "absolute",
							right: "5px",
							top: "5px",
							width: "22px",
						}}
						type="button"
					>
						<X size={13} strokeWidth={2.4} />
					</button>
				</div>
			))}
		</div>
	);
}
