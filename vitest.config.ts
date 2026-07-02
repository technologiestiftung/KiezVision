import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/areaEdit/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/areaEdit/**/*.ts"],
			exclude: ["src/areaEdit/**/*.test.ts"],
		},
	},
});
