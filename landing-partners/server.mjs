import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const allowedFiles = new Map([
	["/", ["index.html", "text/html; charset=utf-8"]],
	["/index.html", ["index.html", "text/html; charset=utf-8"]],
	["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
	["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
	["/calculator.mjs", ["calculator.mjs", "text/javascript; charset=utf-8"]],
	["/assets/geist-latin.woff2", ["assets/geist-latin.woff2", "font/woff2"]],
	["/assets/controlmembers-logo.svg", ["assets/controlmembers-logo.svg", "image/svg+xml"]],
]);
const server = createServer(async (request, response) => {
	const pathname = new URL(request.url, "http://localhost").pathname;
	const file = allowedFiles.get(pathname);
	if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
	if (!file) { response.writeHead(404); response.end("Not found"); return; }
	try {
		const content = await readFile(fileURLToPath(new URL(file[0], import.meta.url)));
		response.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
		response.end(request.method === "HEAD" ? undefined : content);
	} catch { response.writeHead(500); response.end("Unable to load page"); }
});
server.listen(5180, "127.0.0.1", () => console.log("Partner landing: http://127.0.0.1:5180"));
