/** Secure random request identity, including LAN HTTP where randomUUID is unavailable. */
export function createIdempotencyKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
