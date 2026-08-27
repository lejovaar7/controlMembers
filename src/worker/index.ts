import { Hono } from "hono";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { systemCheck } from "./db/schema";

const app = new Hono<{ Bindings: Env }>();

app.all("/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.get("/api/health", async (c) => {
	try {
		const db = getDb(c.env);
		await db.select({ id: systemCheck.id }).from(systemCheck).limit(1);
		return c.json({ status: "ok", database: "ok" });
	} catch (error) {
		console.error("Health check failed", error);
		return c.json({ status: "error", database: "unavailable" }, 503);
	}
});

// Only /api/* reaches the Worker (see run_worker_first in wrangler.json),
// so anything unmatched here is an unknown API route.
app.notFound((c) => c.json({ error: "Not Found" }, 404));

export default app;
