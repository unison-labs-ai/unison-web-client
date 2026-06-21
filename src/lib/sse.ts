// The SSE decode pipeline lives in @unison/client-core — one decoder, one
// forward-compat policy for every Unison client. This module remains as the
// app-local import surface.
export {
	emitSseBlocks,
	flushSseBuffer,
	parseSseBlock,
	type ReadSseStreamOptions,
	readSseStream,
	SseParseError,
	SseRequestError,
} from "@unison/client-core";
