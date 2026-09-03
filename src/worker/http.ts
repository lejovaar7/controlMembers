export class RequestError extends Error {
	constructor(readonly status: 400 | 403 | 409, readonly code: string) { super(code); }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	let value: unknown;
	try { value = await request.json(); } catch { throw new RequestError(400, "INVALID_INPUT"); }
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(400, "INVALID_INPUT");
	return value as Record<string, unknown>;
}

/** Browser writes are same-origin JSON. Non-browser clients may omit Origin. */
export function requireSameOriginJson(env: Env, request: Request) {
	if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
	const origin = request.headers.get("origin");
	if ((origin && origin !== new URL(env.APP_URL).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
		throw new RequestError(403, "INVALID_ORIGIN");
	}
	if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
		throw new RequestError(400, "INVALID_CONTENT_TYPE");
	}
}
