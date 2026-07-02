import { createHash } from "node:crypto";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function resolveGeminiApiKey(env: Record<string, string>): string {
	return (
		env.VITE_GEMINI_API_KEY ||
		env.GEMINI_API_KEY ||
		env.VITE_CUSTOM_GEMINI_API_KEY ||
		env.CUSTOM_GEMINI_API_KEY ||
		""
	);
}

function resolveMapillaryToken(env: Record<string, string>): string {
	return env.VITE_MAPILLARY_ACCESS_TOKEN || env.MAPILLARY_ACCESS_TOKEN || "";
}

function resolveSitePasswordHash(env: Record<string, string>): string {
	const password = (env.SITE_PASSWORD ?? "").trim();
	if (!password) return "";
	return createHash("sha256").update(password).digest("hex");
}

function isSitePasswordEnabled(env: Record<string, string>): boolean {
	const enabled = ["true", "1", "yes"].includes(
		(env.ENABLE_SITE_PASSWORD ?? "").trim().toLowerCase(),
	);
	const hasPassword = (env.SITE_PASSWORD ?? "").trim().length > 0;
	return enabled && hasPassword;
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, ".", "");
	const geminiApiKey = resolveGeminiApiKey(env);
	const mapillaryToken = resolveMapillaryToken(env);

	return {
		server: {
			port: 3000,
			host: "0.0.0.0",
		},
		plugins: [react()],
		define: {
			"import.meta.env.VITE_GEMINI_API_KEY": JSON.stringify(geminiApiKey),
			"import.meta.env.VITE_CUSTOM_GEMINI_API_KEY": JSON.stringify(
				env.VITE_CUSTOM_GEMINI_API_KEY || env.CUSTOM_GEMINI_API_KEY || "",
			),
			"import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN":
				JSON.stringify(mapillaryToken),
			__SITE_PASSWORD_HASH__: JSON.stringify(resolveSitePasswordHash(env)),
			__SITE_PASSWORD_ENABLED__: JSON.stringify(
				isSitePasswordEnabled(env) ? "true" : "false",
			),
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src"),
			},
		},
	};
});
