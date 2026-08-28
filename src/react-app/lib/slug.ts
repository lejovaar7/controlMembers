/** Predictable, URL-safe slug derived from an organization name. */
export function slugify(value: string): string {
	const base = value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return base || "organization";
}

/** Short suffix used only to resolve a slug collision. */
export function slugWithSuffix(slug: string, attempt: number): string {
	return `${slug}-${(attempt + 1).toString(36)}${Math.random()
		.toString(36)
		.slice(2, 6)}`;
}
