/** Client-safe env values (from .env via Vite). Secrets are never hardcoded in source. */

export function getGeminiApiKey(): string | undefined {
	const key =
		import.meta.env.VITE_GEMINI_API_KEY ||
		import.meta.env.VITE_CUSTOM_GEMINI_API_KEY;
	return key?.trim() || undefined;
}

export function getMapillaryAccessToken(): string | undefined {
	const token = import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN;
	return token?.trim() || undefined;
}

export function isSitePasswordEnabled(): boolean {
	return __SITE_PASSWORD_ENABLED__ === "true";
}

export function getSitePasswordHash(): string {
	return __SITE_PASSWORD_HASH__;
}

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
