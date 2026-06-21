"use client";

import { Suspense, use } from "react";

import { DocumentEditor } from "@/features/documents/document-editor";

type Props = {
	params: Promise<{ documentId: string }>;
};

export default function DocumentEditorPage({ params }: Props) {
	const { documentId } = use(params);
	return (
		<Suspense>
			<DocumentEditor documentId={documentId} />
		</Suspense>
	);
}
