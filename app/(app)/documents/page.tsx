"use client";

import { Suspense } from "react";

import { DocumentsList } from "@/features/documents/documents-list";

export default function DocumentsPage() {
	return (
		<Suspense>
			<DocumentsList />
		</Suspense>
	);
}
