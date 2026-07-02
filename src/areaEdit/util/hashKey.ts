/**
 * Deterministic short key for cache routing (not cryptographic).
 * Full payload fingerprint should include image bytes in production services.
 */
export function djb2Hash(str: string): string {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (h * 33) ^ str.charCodeAt(i);
	}
	return (h >>> 0).toString(16);
}

export function buildAreaEditCacheKey(
	parts: Record<string, string | number | boolean | undefined>,
): string {
	const stable = Object.keys(parts)
		.sort()
		.map((k) => `${k}=${parts[k] ?? ""}`)
		.join("|");
	return djb2Hash(stable);
}
