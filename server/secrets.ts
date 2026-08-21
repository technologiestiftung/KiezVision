export function resolveGeminiApiKey(
	env: NodeJS.ProcessEnv = process.env,
): string {
	return (env.GEMINI_API_KEY ?? "").trim();
}

export function resolveMapillaryAccessToken(
	env: NodeJS.ProcessEnv = process.env,
): string {
	return (env.MAPILLARY_ACCESS_TOKEN ?? "").trim();
}
