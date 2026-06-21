"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
	return (
		<Sonner
			theme="dark"
			toastOptions={{
				style: {
					background: "var(--surface)",
					border: "1px solid var(--border)",
					color: "var(--ink)",
				},
			}}
		/>
	);
}
