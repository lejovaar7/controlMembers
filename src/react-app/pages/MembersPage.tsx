import { roleMessage, type MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { MemberForm } from "@/components/member-form";
import { Button } from "@/components/ui/button";
import { useAppShell } from "@/hooks/use-app-shell";
import { setupMessage, type MemberDirectory, type MemberSummary, type SetupEmailStatus } from "@/lib/members";

export function MembersPage() {
	const shell = useAppShell();
	if (!shell.canManageBranches) return <Navigate to="/app/dashboard" replace />;
	// Switching companies discards all old form, request and feedback state.
	return <MemberWorkspace key={`${shell.organizationId}-${shell.organizationRole}-${shell.allBranches}-${shell.branches.map((branch) => branch.id).join(",")}`} />;
}

function MemberWorkspace() {
	const t = useT();
	const shell = useAppShell();
	const [directory, setDirectory] = useState<MemberDirectory | null>(null);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);
	const [form, setForm] = useState<MemberSummary | "new" | null>(null);
	const [message, setMessage] = useState<MessageKey | null>(null);
	const [resending, setResending] = useState<string | null>(null);
	const [statusTarget, setStatusTarget] = useState<MemberSummary | null>(null);
	const [changingStatus, setChangingStatus] = useState(false);
	useEffect(() => {
		if (!shell.canManageBranches) return;
		const controller = new AbortController();
		void fetch("/api/members", { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error("Member list unavailable");
				const result = await response.json() as MemberDirectory;
				if (result.organizationId !== shell.organizationId) throw new Error("Workspace changed");
				if (!controller.signal.aborted) { setDirectory(result); setFailed(false); }
			}).catch(() => { if (!controller.signal.aborted) setFailed(true); });
		return () => controller.abort();
	}, [shell.organizationId, shell.canManageBranches, shell.allBranches, shell.canAppointAdmins, revision]);

	async function changeStatus() {
		if (!statusTarget || changingStatus) return;
		setChangingStatus(true);
		setMessage(null);
		try {
			const response = await fetch(`/api/members/${encodeURIComponent(statusTarget.membershipId)}/status`, {
				method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !statusTarget.isActive }),
			});
			if (!response.ok) throw new Error("Status change unavailable");
			setMessage(statusTarget.isActive ? "Access to this company was deactivated. The account and history were preserved." : "Access to this company was reactivated.");
			setStatusTarget(null);
			setRevision((value) => value + 1);
		} catch { setMessage("We could not change this person's access. Review their permissions and branches, then try again."); }
		finally { setChangingStatus(false); }
	}

	async function resend(entry: MemberSummary) {
		if (resending) return;
		setResending(entry.membershipId);
		setMessage(null);
		try {
			const response = await fetch(`/api/members/${encodeURIComponent(entry.membershipId)}/setup/resend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
			if (!response.ok) throw new Error("Setup unavailable");
			const result = await response.json() as { setupEmailStatus: SetupEmailStatus; };
			setMessage(setupMessage(result.setupEmailStatus));
			setRevision((value) => value + 1);
		} catch { setMessage("We could not resend account setup. Please try again."); }
		finally { setResending(null); }
	}

	const current = directory?.organizationId === shell.organizationId ? directory : null;
	return (
		<PageContainer className="space-y-4">
			<PageHeader title={t("Users & permissions")} description={t("Manage who can sign in to the system and what actions they can perform.")} />
			{message && <p role="status" className="rounded-lg border p-3 text-sm">{message ? t(message) : null}</p>}
			{statusTarget && <section role="alertdialog" aria-labelledby="status-title" aria-describedby="status-description" className="space-y-3 rounded-lg border p-4">
				<h2 id="status-title" className="font-medium">{t(statusTarget.isActive ? "Deactivate access for {name}?" : "Reactivate access for {name}?", { name: statusTarget.user.name })}</h2>
				<p id="status-description" className="text-sm">{t("This affects only {company}. The account and historical records are kept. Access to other companies is unchanged.", { company: shell.organizationName ?? "" })}{!statusTarget.isActive && <> {t("Their saved role, permissions and branch assignments will be restored.")}</>}</p>
				<div className="flex flex-wrap gap-2"><Button autoFocus disabled={changingStatus} onClick={() => void changeStatus()}>{changingStatus ? t("Saving…") : statusTarget.isActive ? t("Confirm deactivation") : t("Confirm reactivation")}</Button><Button variant="outline" disabled={changingStatus} onClick={() => setStatusTarget(null)}>{t("Cancel")}</Button></div>
			</section>}
			{form ? <MemberForm key={`${form === "new" ? "new" : form.membershipId}-${shell.allBranches}-${shell.canAppointAdmins}-${shell.organizationRole}`} branches={shell.branches} member={form === "new" ? undefined : form} allBranchesAllowed={shell.allBranches} canAppointAdmins={shell.canAppointAdmins} isOwner={shell.organizationRole === "owner"} onCancel={() => setForm(null)} onSaved={(status) => { setForm(null); setMessage(status ? setupMessage(status) : "User access updated."); setRevision((value) => value + 1); }} /> : <div><Button disabled={Boolean(statusTarget)} onClick={() => { setMessage(null); setForm("new"); }}>{t("Add user")}</Button></div>}
			{failed ? <div role="alert">{t("We could not load users.")}<Button variant="outline" onClick={() => setRevision((value) => value + 1)}>{t("Try again")}</Button></div> : !current ? <p role="status">{t("Loading users…")}</p> : current.members.length === 0 ? <p>{t("No users found.")}</p> : (
				<ul className="grid gap-4 xl:grid-cols-2">
					{current.members.map((entry) => (
						<li key={entry.membershipId} className="rounded-xl border bg-card p-5 sm:p-6">
							<h2 className="break-words text-lg font-semibold">{entry.user.name}</h2>
							<p className="text-muted-foreground break-all text-sm">{entry.user.email}</p>
							<p className="mt-2 text-sm">{t("Role: {role}", { role: t(roleMessage(entry.role)) })}</p>
							<p className="text-sm">{t("Company access: {status}", { status: t(entry.isActive ? "Active" : "Inactive") })}</p>
							{entry.role === "admin" && <p className="text-sm">{t("Can appoint administrators: {permission}", { permission: t(entry.canAppointAdmins ? "Yes" : "No") })}</p>}
							{shell.organizationRole === "owner" && <p className="text-sm text-muted-foreground">{t("Financial permissions: {permissions}", { permissions: [entry.canReversePayments ? t("reverse payments") : null, entry.canAdjustCharges ? t("adjust charges") : null, entry.canViewReports ? t("view reports") : null, entry.canExportFinancialData ? t("export data") : null].filter(Boolean).join(", ") || t("none") })}</p>}
							<p className="text-sm">{entry.branchAccess.kind === "all-branches" ? t("All branches") : entry.branchAccess.branchIds.map((id) => shell.branches.find((branch) => branch.id === id)?.name).filter(Boolean).join(", ") || t("No branch access")}</p>
							{entry.scopeRestricted && <p className="mt-1 text-sm text-muted-foreground">{t("This person also has access outside your branch scope. The owner or an administrator covering all of their branches must manage their access.")}</p>}
							{entry.setupRequired && entry.isActive && <p className="mt-1 text-sm text-muted-foreground">{t("Account setup pending")}</p>}
							{entry.canManage && <div className="mt-3 flex flex-wrap gap-2">
								<Button variant="outline" aria-label={t("Edit access for {name}", { name: entry.user.name })} disabled={Boolean(form || statusTarget)} onClick={() => { setMessage(null); setForm(entry); }}>{t("Edit access")}</Button>
								<Button variant="outline" aria-label={t(entry.isActive ? "Deactivate company access for {name}" : "Reactivate company access for {name}", { name: entry.user.name })} disabled={Boolean(form || statusTarget || resending)} onClick={() => { setMessage(null); setStatusTarget(entry); }}>{entry.isActive ? t("Deactivate access") : t("Reactivate access")}</Button>
								{entry.setupRequired && entry.isActive && <Button variant="outline" aria-label={t("Resend setup for {name}", { name: entry.user.name })} disabled={Boolean(resending || statusTarget)} onClick={() => void resend(entry)}>{resending === entry.membershipId ? t("Sending…") : t("Resend setup")}</Button>}
							</div>}
						</li>
					))}
				</ul>
			)}
		</PageContainer>
	);
}
