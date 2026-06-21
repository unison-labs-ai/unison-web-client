/** Web microphone capture for realtime transcription: getUserMedia →
 * AudioWorklet (capture + downsample to 16kHz mono PCM16 OFF the main
 * thread) → onChunk. The old implementation used the deprecated
 * ScriptProcessorNode on the main thread, where heavy renders delayed or
 * dropped audio callbacks — real audio loss on long dictations. The worklet
 * is immune to main-thread jank; ScriptProcessor survives only as a fallback
 * for browsers/CSPs that reject blob-URL worklet modules.
 *
 * An AnalyserNode stays on the graph for the waveform visualization.
 */

const TARGET_SAMPLE_RATE = 16_000;
const ANALYSER_FFT_SIZE = 1024;
const FALLBACK_PROCESSOR_BUFFER_SIZE = 4096;
const WORKLET_PROCESSOR_NAME = "unison-pcm-capture";

// Runs inside the AudioWorkletGlobalScope (note: `sampleRate` is a global
// there). Batches ~100ms of input, linear-resamples to 16kHz, posts Int16
// PCM as a transferable.
const WORKLET_MODULE = `
class UnisonPcmCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.buffered = [];
		this.bufferedFrames = 0;
		this.batchFrames = Math.max(128, Math.round(sampleRate * 0.1));
	}

	process(inputs) {
		const channel = inputs[0] && inputs[0][0];

		if (channel && channel.length > 0) {
			this.buffered.push(channel.slice(0));
			this.bufferedFrames += channel.length;

			if (this.bufferedFrames >= this.batchFrames) {
				this.flush();
			}
		}

		return true;
	}

	flush() {
		if (this.bufferedFrames === 0) {
			return;
		}

		const joined = new Float32Array(this.bufferedFrames);
		let offset = 0;

		for (const piece of this.buffered) {
			joined.set(piece, offset);
			offset += piece.length;
		}

		this.buffered = [];
		this.bufferedFrames = 0;

		const ratio = sampleRate / ${TARGET_SAMPLE_RATE};
		const outputLength = Math.max(1, Math.floor(joined.length / ratio));
		const output = new Int16Array(outputLength);

		for (let index = 0; index < outputLength; index += 1) {
			const sourceIndex = index * ratio;
			const low = Math.floor(sourceIndex);
			const high = Math.min(joined.length - 1, low + 1);
			const fraction = sourceIndex - low;
			const sample = (joined[low] || 0) * (1 - fraction) + (joined[high] || 0) * fraction;
			const clamped = Math.max(-1, Math.min(1, sample));

			output[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
		}

		this.port.postMessage(output.buffer, [output.buffer]);
	}
}

registerProcessor("${WORKLET_PROCESSOR_NAME}", UnisonPcmCaptureProcessor);
`;

type AudioContextConstructor = typeof AudioContext;
type WindowWithWebkitAudioContext = Window &
	typeof globalThis & {
		webkitAudioContext?: AudioContextConstructor;
	};

function getAudioContextConstructor(): AudioContextConstructor | null {
	if (typeof window === "undefined") {
		return null;
	}

	return window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext ?? null;
}

function copyArrayBuffer(view: Int16Array): ArrayBuffer {
	const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
	const copy = new Uint8Array(bytes.byteLength);

	copy.set(bytes);

	return copy.buffer;
}

function floatToInt16PcmBuffer(input: Float32Array, inputSampleRate: number): ArrayBuffer {
	const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
	const outputLength = Math.max(1, Math.floor(input.length / ratio));
	const output = new Int16Array(outputLength);

	for (let index = 0; index < outputLength; index += 1) {
		const sourceIndex = index * ratio;
		const low = Math.floor(sourceIndex);
		const high = Math.min(input.length - 1, low + 1);
		const fraction = sourceIndex - low;
		const sample = (input[low] ?? 0) * (1 - fraction) + (input[high] ?? 0) * fraction;
		const clamped = Math.max(-1, Math.min(1, sample));

		output[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
	}

	return copyArrayBuffer(output);
}

export type WebPcmSource = {
	/** Set once start() resolves; feeds DictationWaveform. */
	analyser: AnalyserNode | null;
	start(onChunk: (pcm16: ArrayBuffer) => void): Promise<void>;
	stop(): Promise<void>;
};

export function createWebPcmSource(): WebPcmSource {
	let context: AudioContext | null = null;
	let mediaStream: MediaStream | null = null;
	let sourceNode: MediaStreamAudioSourceNode | null = null;
	let workletNode: AudioWorkletNode | null = null;
	let processorNode: ScriptProcessorNode | null = null;
	let muteGain: GainNode | null = null;
	let workletUrl: string | null = null;

	const source: WebPcmSource = {
		analyser: null,
		async start(onChunk) {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error("This browser does not support microphone dictation.");
			}

			const AudioContextImpl = getAudioContextConstructor();

			if (!AudioContextImpl) {
				throw new Error("This browser does not support microphone dictation.");
			}

			mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					autoGainControl: true,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});
			context = new AudioContextImpl();
			void context.resume().catch(() => undefined);

			sourceNode = context.createMediaStreamSource(mediaStream);

			const analyser = context.createAnalyser();

			analyser.fftSize = ANALYSER_FFT_SIZE;
			sourceNode.connect(analyser);
			source.analyser = analyser;

			muteGain = context.createGain();
			muteGain.gain.value = 0;
			muteGain.connect(context.destination);

			try {
				workletUrl = URL.createObjectURL(
					new Blob([WORKLET_MODULE], { type: "application/javascript" }),
				);
				await context.audioWorklet.addModule(workletUrl);
				workletNode = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
					channelCount: 1,
					numberOfInputs: 1,
					numberOfOutputs: 1,
				});
				workletNode.port.onmessage = (event) => onChunk(event.data as ArrayBuffer);
				sourceNode.connect(workletNode);
				workletNode.connect(muteGain);
			} catch {
				// Worklet unavailable (old browser, strict CSP on blob workers) —
				// fall back to the deprecated main-thread processor.
				const processor = context.createScriptProcessor(FALLBACK_PROCESSOR_BUFFER_SIZE, 1, 1);
				const contextSampleRate = context.sampleRate;

				processor.onaudioprocess = (event) => {
					onChunk(floatToInt16PcmBuffer(event.inputBuffer.getChannelData(0), contextSampleRate));
				};
				sourceNode.connect(processor);
				processor.connect(muteGain);
				processorNode = processor;
			}
		},
		async stop() {
			workletNode?.port.close();
			workletNode?.disconnect();
			processorNode?.disconnect();
			sourceNode?.disconnect();
			source.analyser?.disconnect();
			muteGain?.disconnect();
			workletNode = null;
			processorNode = null;
			sourceNode = null;
			source.analyser = null;
			muteGain = null;

			for (const track of mediaStream?.getTracks() ?? []) {
				track.stop();
			}
			mediaStream = null;

			if (workletUrl) {
				URL.revokeObjectURL(workletUrl);
				workletUrl = null;
			}

			const closing = context;

			context = null;
			await closing?.close().catch(() => undefined);
		},
	};

	return source;
}
