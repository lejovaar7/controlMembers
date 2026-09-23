import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
			<thead role="rowgroup"><tr role="row">{headers.map((label, index) => <th key={label} scope="col" role="columnheader" className={index === 3 ? "table-status" : index === 4 ? "user-actions" : undefined}>{label}</th>)}</tr></thead>
			<tbody role="rowgroup">
				{loading ? [0, 1, 2, 3].map((row) => <tr key={row} role="row" aria-hidden="true">{headers.map((label, index) => <td key={label} role="cell" data-label={label} className={index === 3 ? "table-status" : index === 4 ? "user-actions" : undefined}><Skeleton className="h-4 w-24 max-w-full" /></td>)}</tr>) : members.map((entry) => <tr key={entry.membershipId} role="row">
					<td role="cell" className="member-name" data-label={headers[0]}><div className="min-w-0 space-y-1"><p className="font-semibold">{entry.user.name}</p><p className="text-xs leading-5 text-muted-foreground">{entry.user.email}</p></div></td>
					<td role="cell" data-label={headers[1]}><div className="space-y-2"><p className="font-medium">{t(roleMessage(entry.role))}</p>{(isOwner || entry.role === "admin") && <details className="user-permissions group text-xs leading-5 text-muted-foreground">
						<summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">{t("View permissions")}<ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" /></summary>
						{entry.role === "admin" && <p>{t("Can appoint administrators: {permission}", { permission: t(entry.canAppointAdmins ? "Yes" : "No") })}</p>}
						{isOwner && <p>{t("Financial permissions: {permissions}", { permissions: [entry.canReversePayments ? t("cancel payments") : null, entry.canAdjustCharges ? t("adjust charges") : null, entry.canViewReports ? t("view reports") : null, entry.canExportFinancialData ? t("export data") : null].filter(Boolean).join(", ") || t("none") })}</p>}
					</details>}</div></td>
					<td role="cell" data-label={headers[2]}><div className="space-y-2"><div className="user-branch-badges flex flex-wrap gap-1.5">{entry.branchAccess.kind === "all-branches" ? <StatusBadge>{t("All branches")}</StatusBadge> : entry.branchAccess.branchIds.some((id) => branches.some((branch) => branch.id === id)) ? entry.branchAccess.branchIds.map((id) => { const branch = branches.find((item) => item.id === id); return branch ? <span key={id} className="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium">{branch.name}</span> : null; }) : <span className="text-sm text-muted-foreground">{t("No branch access")}</span>}</div>{entry.scopeRestricted && <p className="text-xs leading-5 text-muted-foreground">{t("This person also has access outside your branch scope. The owner or an administrator covering all of their branches must manage their access.")}</p>}</div></td>
					<td role="cell" data-label={headers[3]} className="table-status"><StatusBadge tone={!entry.isActive ? "neutral" : entry.setupRequired ? "warning" : "success"}>{t(!entry.isActive ? "Inactive" : entry.setupRequired ? "Pending activation" : "Active")}</StatusBadge></td>
					<td role="cell" className="user-actions" data-label={headers[4]}>{entry.canManage ? actions(entry) : <span className="text-xs text-muted-foreground">{t("Read only")}</span>}</td>
				</tr>)}
			</tbody>
		</table>
	</div>;
}
