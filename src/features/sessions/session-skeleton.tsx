import { Skeleton } from "@/ui/skeleton";

/** Message-shaped bones for the transcript column (user bubble right,
 * assistant lines left) — shown while the message snapshot loads so the
 * canvas never flashes "No messages yet." before content arrives. */
export function TranscriptSkeleton() {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px 0" }}>
			<Skeleton
				style={{
					alignSelf: "flex-end",
					borderRadius: "var(--radius-lg)",
					height: "38px",
					width: "40%",
				}}
			/>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<Skeleton style={{ height: "14px", width: "85%" }} />
				<Skeleton style={{ height: "14px", width: "70%" }} />
				<Skeleton style={{ height: "14px", width: "45%" }} />
			</div>
			<Skeleton
				style={{
					alignSelf: "flex-end",
					borderRadius: "var(--radius-lg)",
					height: "38px",
					width: "30%",
				}}
			/>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<Skeleton style={{ height: "14px", width: "75%" }} />
				<Skeleton style={{ height: "14px", width: "55%" }} />
			</div>
		</div>
	);
}

/** Full-page bones matching SessionViewInner's real geometry — breadcrumb
 * header (no border), centered 768px transcript column, rounded composer
 * dock — so the route fallback, the thread fetch and the message fetch all
 * paint the same frame and the hand-offs between them are invisible. */
export function SessionViewSkeleton() {
	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div className="flex min-h-12 shrink-0 items-center gap-2 px-4 md:min-h-14">
				<Skeleton style={{ height: "14px", width: "60px" }} />
				<Skeleton style={{ height: "14px", maxWidth: "40%", width: "180px" }} />
				<div style={{ flex: 1 }} />
				<Skeleton style={{ borderRadius: "var(--radius-sm)", height: "18px", width: "44px" }} />
			</div>
			<div
				style={{
					display: "flex",
					flex: 1,
					flexDirection: "column",
					minHeight: 0,
					position: "relative",
				}}
			>
				<div style={{ flex: 1, overflow: "hidden", padding: "0 16px" }}>
					<div style={{ margin: "0 auto", maxWidth: "768px", width: "100%" }}>
						<TranscriptSkeleton />
					</div>
				</div>
				<div
					style={{
						background: "var(--background)",
						display: "flex",
						justifyContent: "center",
						padding: "0 16px max(14px, env(safe-area-inset-bottom))",
					}}
				>
					<div style={{ maxWidth: "768px", width: "100%" }}>
						<Skeleton style={{ borderRadius: "22px", height: "94px", width: "100%" }} />
					</div>
				</div>
			</div>
		</div>
	);
}
