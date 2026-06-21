/** The platform seam for realtime transcription. The engine consumes 16kHz
 * mono PCM16 chunks and nothing else; everything platform-specific — expo-audio
 * on mobile, AudioWorklet on web, permissions, level metering, the local
 * safety cache tee — lives behind this interface in the client.
 */
export type AudioSource = {
	/** Begin capture. `onChunk` receives 16kHz mono PCM16 buffers in order. */
	start(onChunk: (pcm16: ArrayBuffer) => void): Promise<void>;
	stop(): Promise<void>;
};
