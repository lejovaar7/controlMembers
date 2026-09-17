import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => {
	const remoteDev = process.env.CONTROLMEMBERS_REMOTE_DEV === "true";
	if (remoteDev && (command !== "serve" || isPreview || process.env.CLOUDFLARE_ENV
		|| process.env.CLOUDFLARE_VITE_FORCE_LOCAL !== "false")) {
		throw new Error("Remote development bindings are only supported through npm run dev.");
	}
	const databaseId = process.env.CONTROLMEMBERS_DEV_DATABASE_ID;
	const databaseName = process.env.CONTROLMEMBERS_DEV_DATABASE_NAME;
	if (remoteDev && (!databaseId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(databaseId) || !databaseName)) {
		throw new Error("The dev command must select the configured dev D1 database.");
	}
	return {
		// Only development connects to dev D1 and EMAIL; preview/tests remain local.
		plugins: [react(), tailwindcss(), cloudflare({
			remoteBindings: remoteDev,
			config: remoteDev ? (config) => {
				if (config.d1_databases.length !== 1 || config.d1_databases[0].binding !== "DB") {
					throw new Error("Development requires exactly one DB binding.");
				}
				if (config.send_email.length !== 1 || config.send_email[0].name !== "EMAIL") {
					throw new Error("Real local email requires exactly one EMAIL binding.");
				}
				// Mutate the existing entry: returning an array appends to the original.
				config.d1_databases[0].database_id = databaseId!;
				config.d1_databases[0].database_name = databaseName!;
				config.d1_databases[0].remote = true;
				config.send_email[0].remote = true;
			} : undefined,
		})],
		resolve: {
			alias: {
				"@": path.resolve(import.meta.dirname, "./src/react-app"),
			},
		},
	};
});
