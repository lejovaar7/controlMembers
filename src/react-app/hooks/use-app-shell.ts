import { useOutletContext } from "react-router";
import type { Branch } from "@/hooks/use-branches";

/**
 * Shell state resolved once by AppLayout and shared with nested routes, so a
 * page never refetches the branch list AppLayout already has.
 */
export type AppShellContext = {
	organizationId: string;
	organizationName: string | null;
	/** Branches the current user may actually use, from the Worker. */
	branches: Branch[];
	activeBranch: Branch | null;
	/** Organization role: "owner" | "admin" | "member". */
	organizationRole: string | null;
	canManageBranches: boolean;
	refreshBranches: () => void;
};

export function useAppShell(): AppShellContext {
	return useOutletContext<AppShellContext>();
}

export function canManageBranches(role: string | null | undefined): boolean {
	return role === "owner" || role === "admin";
}
