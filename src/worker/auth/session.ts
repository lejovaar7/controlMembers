import { getAuth } from ".";

/**
 * Resolves the Better Auth session for an incoming request.
 * Session validation is entirely Better Auth's; never parse cookies here.
 */
export async function getCurrentSession(env: Env, request: Request) {
	return await getAuth(env).api.getSession({ headers: request.headers });
}

export type AuthenticatedSession = NonNullable<
	Awaited<ReturnType<typeof getCurrentSession>>
>;

/** Thrown when a guard fails. Routes turn this into a JSON response. */
export class AuthError extends Error {
	constructor(
		readonly status: 401 | 403 | 404,
		readonly code: string,
	) {
		super(code);
	}
}

/** Requires an authenticated user. */
export async function requireAuth(
	env: Env,
	request: Request,
): Promise<AuthenticatedSession> {
	const session = await getCurrentSession(env, request);
	if (!session) throw new AuthError(401, "UNAUTHENTICATED");
	return session;
}

/**
 * Platform scope, not tenant scope.
 *
 * `user.role === "admin"` is a platform administrator (Better Auth Admin
 * plugin). It is unrelated to `member.role === "admin"`, which administers a
 * single organization. Being an organization owner or admin never grants this.
 */
export async function requirePlatformAdmin(
	env: Env,
	request: Request,
): Promise<AuthenticatedSession> {
	const session = await requireAuth(env, request);
	const role = (session.user as { role?: string | null }).role;
	const roles = typeof role === "string" ? role.split(",") : [];
	if (!roles.includes("admin")) throw new AuthError(403, "NOT_PLATFORM_ADMIN");
	return session;
}
