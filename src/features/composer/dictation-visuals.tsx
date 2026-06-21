"use client";

import { type RefObject, useEffect, useRef } from "react";

const WAVEFORM_HEIGHT = 32;
const BAR_WIDTH = 3;
const BAR_STEP = 7;
const BUCKET_MS = 90;
const BASELINE_DOT_HEIGHT = 3;
const SILENCE_THRESHOLD = 0.025;
const LEVEL_GAIN = 6;
const LEVEL_ATTACK = 0.5;
const LEVEL_DECAY = 0.12;
const LEFT_FADE_WIDTH = 28;

export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}

	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readLevel(analyser: AnalyserNode | null, buffer: Uint8Array<ArrayBuffer>): number {
	if (!analyser) {
		return 0;
	}

	analyser.getByteTimeDomainData(buffer);

	let sumSquares = 0;

	for (let index = 0; index < buffer.length; index += 1) {
		const centered = ((buffer[index] ?? 128) - 128) / 128;

		sumSquares += centered * centered;
	}

	const level = Math.sqrt(sumSquares / buffer.length) * LEVEL_GAIN;

	return level < SILENCE_THRESHOLD ? 0 : Math.min(1, level);
}

function barHeight(level: number): number {
	if (level <= 0) {
		return BASELINE_DOT_HEIGHT;
	}

	const shapedLevel = level ** 0.72;

	return BASELINE_DOT_HEIGHT + shapedLevel * (WAVEFORM_HEIGHT - BASELINE_DOT_HEIGHT);
}

function barAlpha(level: number): number {
	return level > 0 ? 0.72 + Math.min(0.28, level * 0.5) : 0.5;
}

export function DictationWaveform({
	analyserRef,
}: {
	analyserRef: RefObject<AnalyserNode | null>;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");

		if (!container || !canvas || !context) {
			return;
		}

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let width = 0;
		let barColor = "#fbfcfc";
		let fadeGradient: CanvasGradient | null = null;
		let timeDomain = new Uint8Array(0);
		// History of committed bucket peaks, newest last; prefilled so the row of
		// baseline dots spans the full width from the first frame.
		let history: number[] = [];
		let bucketStart = performance.now();
		let bucketPeak = 0;
		let smoothedLevel = 0;
		let frame = 0;

		const maxBars = () => Math.ceil(width / BAR_STEP) + 2;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;

			width = container.clientWidth;
			canvas.width = Math.max(1, Math.round(width * dpr));
			canvas.height = WAVEFORM_HEIGHT * dpr;
			canvas.style.width = `${width}px`;
			canvas.style.height = `${WAVEFORM_HEIGHT}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
			barColor = getComputedStyle(canvas).color || barColor;

			const fadeEnd = Math.min(LEFT_FADE_WIDTH, width);

			fadeGradient = context.createLinearGradient(0, 0, fadeEnd, 0);
			fadeGradient.addColorStop(0, "rgba(0, 0, 0, 1)");
			fadeGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

			while (history.length < maxBars()) {
				history.unshift(0);
			}
			history = history.slice(-maxBars());
		};

		const pushSample = (level: number) => {
			history.push(level);
			history = history.slice(-maxBars());
		};

		const draw = (now: number) => {
			const analyser = analyserRef.current;

			if (analyser && timeDomain.length !== analyser.fftSize) {
				timeDomain = new Uint8Array(analyser.fftSize);
			}

			const level = readLevel(analyser, timeDomain);
			const smoothing = level > smoothedLevel ? LEVEL_ATTACK : LEVEL_DECAY;

			smoothedLevel += (level - smoothedLevel) * smoothing;
			if (smoothedLevel < SILENCE_THRESHOLD) {
				smoothedLevel = 0;
			}
			bucketPeak = Math.max(bucketPeak, smoothedLevel);

			const elapsed = now - bucketStart;

			if (elapsed >= BUCKET_MS) {
				// Commit one bucket per interval; after a throttled stretch (background
				// tab) backfill the gap with silence instead of replaying one peak.
				const steps = Math.min(Math.floor(elapsed / BUCKET_MS), maxBars());

				pushSample(bucketPeak);
				for (let index = 1; index < steps; index += 1) {
					pushSample(0);
				}
				bucketStart += steps * BUCKET_MS;
				if (now - bucketStart >= BUCKET_MS) {
					bucketStart = now;
				}
				bucketPeak = smoothedLevel;
			}

			const offset = reduceMotion ? 0 : ((now - bucketStart) / BUCKET_MS) * BAR_STEP;
			const centerY = WAVEFORM_HEIGHT / 2;

			context.clearRect(0, 0, width, WAVEFORM_HEIGHT);
			context.fillStyle = barColor;

			// Slot 0 is the live, still-forming bucket; it spawns at the right edge
			// and slides left with the committed history at constant velocity, so the
			// handoff from live to committed is seamless.
			for (let slot = 0; ; slot += 1) {
				const x = width - BAR_WIDTH - offset - slot * BAR_STEP;

				if (x + BAR_WIDTH <= 0) {
					break;
				}

				const value = slot === 0 ? bucketPeak : (history[history.length - slot] ?? 0);
				const height = barHeight(value);

				context.globalAlpha = barAlpha(value);
				context.beginPath();
				context.roundRect(x, centerY - height / 2, BAR_WIDTH, height, BAR_WIDTH / 2);
				context.fill();
			}

			context.globalAlpha = 1;
			if (fadeGradient) {
				context.globalCompositeOperation = "destination-out";
				context.fillStyle = fadeGradient;
				context.fillRect(0, 0, Math.min(LEFT_FADE_WIDTH, width), WAVEFORM_HEIGHT);
				context.globalCompositeOperation = "source-over";
			}

			frame = window.requestAnimationFrame(draw);
		};

		resize();

		const observer = new ResizeObserver(resize);

		observer.observe(container);
		frame = window.requestAnimationFrame(draw);

		return () => {
			observer.disconnect();
			window.cancelAnimationFrame(frame);
		};
	}, [analyserRef]);

	return (
		<div
			aria-hidden
			ref={containerRef}
			style={{
				flex: 1,
				height: `${WAVEFORM_HEIGHT}px`,
				minWidth: 0,
				overflow: "hidden",
				position: "relative",
			}}
		>
			<canvas
				ref={canvasRef}
				style={{ color: "var(--ink)", display: "block", left: 0, position: "absolute", top: 0 }}
			/>
		</div>
	);
}
