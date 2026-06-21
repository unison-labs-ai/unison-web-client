import { CaptureDetail } from "@/features/captures/capture-detail";

type Props = {
	params: Promise<{ captureId: string }>;
};

export default async function CaptureDetailPage({ params }: Props) {
	const { captureId } = await params;
	return <CaptureDetail captureId={captureId} />;
}
