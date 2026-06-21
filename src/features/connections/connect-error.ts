import { WebApiError } from "@/lib/api";

const GENERIC_CONNECT_ERROR = "Failed to start connection flow. Try again.";

/** The server's error envelope says exactly why a connect flow failed (e.g.
 * "Granola OAuth client registration failed."); show that over a blind
 * "try again" whenever we have it. */
export function connectErrorMessage(error: unknown): string {
	if (error instanceof WebApiError && error.message.trim().length > 0) {
		return error.message;
	}

	return GENERIC_CONNECT_ERROR;
}
