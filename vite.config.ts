import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	// Local dev and preview must never connect to remote D1 or send real email.
	// This does not affect bindings in a deployed Worker.
	plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: false })],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src/react-app"),
		},
	},
});
