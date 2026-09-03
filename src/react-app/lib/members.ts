import type { MessageKey } from "../../shared/i18n";

/** Browser transport types; Worker-only modules are never imported here. */
export type MemberSummary = {
	membershipId: string;
	user: { id: string; name: string; email: string };
	role: string;
	isActive: boolean;
	canAppointAdmins: boolean;
	setupRequired: boolean;
	canManage: boolean;
	scopeRestricted: boolean;
	branchAccess: { kind: "all-branches" } | { kind: "assigned-branches"; branchIds: string[] };
};

export type MemberDirectory = { organizationId: string; members: MemberSummary[] };

export type MemberAccess = { role: "admin" | "member"; branchIds: string[]; allBranches: boolean; canAppointAdmins?: boolean };
export type SetupEmailStatus = "sent" | "not-required" | "failed";

export function setupMessage(status: SetupEmailStatus): MessageKey {
	if (status === "sent") return "Access saved. An account setup email was sent.";
	if (status === "failed") return "Access saved, but the setup email could not be sent. Use Resend setup to try again.";
	return "Access saved. This person can sign in with their existing account.";
}
