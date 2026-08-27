import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations(
	path.join(import.meta.dirname, "drizzle"),
);

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.json" },
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
		setupFiles: ["./test/setup.ts"],
	},
});
