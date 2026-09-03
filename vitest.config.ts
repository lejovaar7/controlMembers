import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations(
	path.join(import.meta.dirname, "drizzle"),
);

export default defineConfig({
	plugins: [
		cloudflareTest({
			remoteBindings: false,
			wrangler: { configPath: "./wrangler.json", environment: "" },
			miniflare: {
				// Test-only values. Never the real secret, domain or recipient.
				bindings: {
					TEST_MIGRATIONS: migrations,
					BETTER_AUTH_SECRET: "test-only-secret-value-not-used-anywhere-else",
					APP_URL: "http://localhost:5173",
					EMAIL_FROM: "no-reply@test.invalid",
				},
			},
		}),
	],
	test: {
		include: ["test/**/*.test.ts"],
		setupFiles: ["./test/setup.ts"],
	},
});
