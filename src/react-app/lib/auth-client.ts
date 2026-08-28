import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Same-origin, so no base URL is needed.
 * Nothing here is authoritative: backend guards decide access.
 */
export const authClient = createAuthClient();

export const { useSession } = authClient;
