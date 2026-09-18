import { Link, useNavigate } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import type { CustomerMember } from "@/lib/controlmembers";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "../../shared/i18n";

/** A semantic directory table that stacks labeled fields in narrow containers. */
export function MembersTable({ members, currency, loading = false }: { members: CustomerMember[]; currency: string; loading?: boolean }) {
	const { locale, t } = useI18n();
	const navigate = useNavigate();
	const headers = [t("Member"), t("Phone"), t("Email"), t("Status"), t("Outstanding")];
	return <div className="member-directory rounded-2xl border bg-card shadow-sm" aria-busy={loading}>
		{loading ? <span role="status" className="sr-only">{t("Loading members…")}</span> : null}
		<table className="members-table" role="table">
			<caption className="sr-only">{t("Members")}</caption>
			<thead role="rowgroup"><tr role="row">{headers.map((label, index) => <th key={label} scope="col" role="columnheader" className={index === 3 ? "table-status" : index === 4 ? "member-balance" : undefined}>{label}</th>)}</tr></thead>
			<tbody role="rowgroup">
				{loading ? [0, 1, 2, 3].map((row) => <tr key={row} role="row" aria-hidden="true">{headers.map((label, column) => <td key={label} role="cell" data-label={label} className={column === 3 ? "table-status" : column === 4 ? "member-balance" : undefined}><Skeleton className={column === 0 ? "h-4 w-40 max-w-full" : "h-4 w-20 max-w-full"} /></td>)}</tr>) : members.map((member) => <tr key={member.id} role="row" className="member-clickable-row" onClick={(event) => {
					// Keep the name's native link behavior and allow selecting/copying row text.
					if (event.target instanceof Element && event.target.closest("a")) return;
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed && selection.containsNode(event.currentTarget, true)) return;
					navigate("/app/customer-members/" + member.id);
				}}>
					<td role="cell" data-label={headers[0]} className="member-name"><Link to={`/app/customer-members/${member.id}`} className="member-name-link">{member.displayName}</Link></td>
					<td role="cell" data-label={headers[1]}><span className={member.phoneE164 ? "tabular-nums" : "text-muted-foreground"}>{member.phoneE164 || t("Not provided")}</span></td>
					<td role="cell" data-label={headers[2]}><div className="member-contact"><span className="text-muted-foreground">{member.email || t("Not provided")}</span></div></td>
					<td role="cell" data-label={headers[3]} className="table-status"><StatusBadge tone={member.status === "active" ? "success" : member.status === "paused" ? "warning" : "neutral"}>{t(member.status === "active" ? "Active" : member.status === "paused" ? "Paused" : "Inactive")}</StatusBadge></td>
					<td role="cell" data-label={headers[4]} className="member-balance"><span className="font-semibold tabular-nums">{formatMoney(locale, member.outstandingMinor, currency)}</span></td>

				</tr>)}
			</tbody>
		</table>
	</div>;
}
