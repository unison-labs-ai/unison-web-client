import type { ThreadMessageSendResponse } from "@unison/contracts";

/**
 * Hands the home composer's send 202 to the session view it navigates to, so
 * the first turn renders instantly — no skeleton flash, no message refetch —
 * and the live stream attaches from event 0.
 *
 * Peek is non-destructive: StrictMode double-renders must observe the same
 * value. The session view clears the slot once the durable snapshot takes
 * over (terminal-event refresh), so navigating back to a finished session
 * never re-seeds stale messages.
 */
let slot: ThreadMessageSendResponse | null = null;

export function stashFirstTurn(response: ThreadMessageSendResponse): void {
	slot = response;
}

export function peekFirstTurn(threadId: string): ThreadMessageSendResponse | null {
	return slot && slot.thread.id === threadId ? slot : null;
}

export function clearFirstTurn(threadId: string): void {
	if (slot && slot.thread.id === threadId) slot = null;
}
