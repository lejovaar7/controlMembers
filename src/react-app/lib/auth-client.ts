import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Same-origin, so no base URL is needed.
 * Nothing here is authoritative: backend guards decide access.
 *
 * An organization is a tenant and a team is a branch (see CLAUDE.md).
 */
export const authClient = createAuthClient({
	plugins: [organizationClient({ teams: { enabled: true } })],
});

export const { useSession } = authClient;
