import { createHash } from "node:crypto";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apiDevPlugin } from "./server/apiDevPlugin.ts";

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

	return {
		server: {
			port: 3000,
			host: "0.0.0.0",
		},
		plugins: [react(), apiDevPlugin(mode)],
		define: {
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
