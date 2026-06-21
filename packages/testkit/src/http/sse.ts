/**
 * SSE test utilities: sample a streaming `Response` without draining it, and
 * split SSE wire text into its raw `data:` payloads. Schema validation stays
 * with the consumer (the contracts package owns the event schemas).
 */

/** Read a streaming response until `dataEventCount` data events arrived (or 20 chunks). */
export async function readSseSample(response: Response, dataEventCount = 1): Promise<string> {
	const reader = response.body?.getReader();

	if (!reader) {
		return response.text();
	}

	const decoder = new TextDecoder();
	let text = "";

	for (let index = 0; index < 20; index += 1) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		text += decoder.decode(value, { stream: true });

		if ((text.match(/\ndata:/g)?.length ?? 0) >= dataEventCount) {
			break;
		}
	}

	await reader.cancel().catch(() => undefined);

	return text + decoder.decode();
}

/** Split SSE text into raw data payload strings, dropping empties and `[DONE]`. */
export function parseSseDataBlocks(text: string): string[] {
	return text
		.split(/\n\n/)
		.map((block) =>
			block
				.split(/\r?\n/)
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trimStart())
				.join("\n"),
		)
		.filter((data) => data.length > 0 && data !== "[DONE]");
}
