"use client";

import { useEffect, useState } from "react";

/** Ticking clock for live elapsed-time cells. One instance per table — pass the
 * value down instead of running an interval per row. Freezes when disabled. */
export function useNow(enabled: boolean, intervalMs = 1000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!enabled) return;
		setNow(Date.now());
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [enabled, intervalMs]);
	return now;
}
