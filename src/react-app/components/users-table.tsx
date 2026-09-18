import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { Branch } from "@/hooks/use-branches";
import type { MemberSummary } from "@/lib/members";
import { useT } from "@/lib/i18n";
import { roleMessage } from "../../shared/i18n";

/** Staff access stays separate from the customer member directory. */
export function UsersTable({ members, branches, isOwner, loading = false, actions }: {
	members: MemberSummary[];
	branches: Branch[];
	isOwner: boolean;
	loading?: boolean;
	actions: (member: MemberSummary) => ReactNode;
}) {
	const t = useT();
	const headers = [t("User"), t("Company role"), t("Branch access"), t("Status"), t("Actions")];
	return <div className="member-directory rounded-2xl border bg-card shadow-sm" aria-busy={loading}>
		{loading && <span role="status" className="sr-only">{t("Loading users…")}</span>}
		<table className="members-table users-table" role="table">
			<caption className="sr-only">{t("Users & permissions")}</caption>
			<thead role="rowgroup"><tr role="row">{headers.map((label) => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
			<tbody role="rowgroup">
				{loading ? [0, 1, 2, 3].map((row) => <tr key={row} role="row" aria-hidden="true">{headers.map((label) => <td key={label} role="cell" data-label={label}><Skeleton className="h-4 w-24 max-w-full" /></td>)}</tr>) : members.map((entry) => <tr key={entry.membershipId} role="row">
					<td role="cell" className="member-name" data-label={headers[0]}><div className="min-w-0 space-y-1"><p className="font-semibold">{entry.user.name}</p><p className="text-xs leading-5 text-muted-foreground">{entry.user.email}</p></div></td>
					<td role="cell" data-label={headers[1]}><div className="space-y-2"><p className="font-medium">{t(roleMessage(entry.role))}</p>{(isOwner || entry.role === "admin") && <details className="text-xs leading-5 text-muted-foreground">
						<summary className="cursor-pointer rounded-sm py-1 font-medium text-foreground">{t("View permissions")}</summary>
						{entry.role === "admin" && <p>{t("Can appoint administrators: {permission}", { permission: t(entry.canAppointAdmins ? "Yes" : "No") })}</p>}
						{isOwner && <p>{t("Financial permissions: {permissions}", { permissions: [entry.canReversePayments ? t("cancel payments") : null, entry.canAdjustCharges ? t("adjust charges") : null, entry.canViewReports ? t("view reports") : null, entry.canExportFinancialData ? t("export data") : null].filter(Boolean).join(", ") || t("none") })}</p>}
					</details>}</div></td>
					<td role="cell" data-label={headers[2]}><div className="space-y-2"><p>{entry.branchAccess.kind === "all-branches" ? t("All branches") : entry.branchAccess.branchIds.map((id) => branches.find((branch) => branch.id === id)?.name).filter(Boolean).join(", ") || t("No branch access")}</p>{entry.scopeRestricted && <p className="text-xs leading-5 text-muted-foreground">{t("This person also has access outside your branch scope. The owner or an administrator covering all of their branches must manage their access.")}</p>}</div></td>
					<td role="cell" data-label={headers[3]}><div className="space-y-2"><StatusBadge tone={entry.isActive ? "success" : "neutral"}>{t(entry.isActive ? "Active" : "Inactive")}</StatusBadge>{entry.setupRequired && entry.isActive && <p className="text-xs leading-5 text-muted-foreground">{t("Account setup pending")}</p>}</div></td>
					<td role="cell" className="user-actions" data-label={headers[4]}>{entry.canManage ? actions(entry) : <span className="text-xs text-muted-foreground">{t("Read only")}</span>}</td>
				</tr>)}
			</tbody>
		</table>
	</div>;
}
