import { LoadingButton } from "@/components/loading-button";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { UsersTable } from "@/components/users-table";
import { Plus } from "lucide-react";
import { type MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
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
	const createButtonRef = useRef<HTMLButtonElement>(null);
	const editButtonRef = useRef<HTMLButtonElement>(null);
	const { dialog, openDialog } = useActionDialog();
	const t = useT();
	const shell = useAppShell();
	const [directory, setDirectory] = useState<MemberDirectory | null>(null);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);
	const [form, setForm] = useState<MemberSummary | "new" | null>(null);
	const [message, setMessage] = useState<MessageKey | null>(null);
	const [resending, setResending] = useState<string | null>(null);
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

	function changeStatus(entry: MemberSummary) {
		setMessage(null);
		openDialog({ title: t(entry.isActive ? "Deactivate access for {name}?" : "Reactivate access for {name}?", { name: entry.user.name }),
			description: t("This affects only {company}. The account and historical records are kept. Access to other companies is unchanged.", { company: shell.organizationName ?? "" }) + (entry.isActive ? "" : ` ${t("Their saved role, permissions and branch assignments will be restored.")}`),
			confirmLabel: t(entry.isActive ? "Confirm deactivation" : "Confirm reactivation"), destructive: entry.isActive,
			onConfirm: async () => {
				const response = await fetch(`/api/members/${encodeURIComponent(entry.membershipId)}/status`, {
					method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !entry.isActive }),
				});
				if (!response.ok) throw new Error("Status change unavailable");
				setMessage(entry.isActive ? "Access to this company was deactivated. The account and history were preserved." : "Access to this company was reactivated.");
				setRevision((value) => value + 1);
			},
		});
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
			{dialog}
			<PageHeader title={t("Users & permissions")} description={t("Manage who can sign in to the system and what actions they can perform.")} actions={<Button ref={createButtonRef} onClick={() => { setMessage(null); setForm("new"); }}><Plus aria-hidden="true" />{t("Add user")}</Button>} />
			{message && <p role="status" className="rounded-lg border p-3 text-sm">{message ? t(message) : null}</p>}
			{form ? <MemberForm inDialog returnFocus={form === "new" ? createButtonRef : editButtonRef} key={`${form === "new" ? "new" : form.membershipId}-${shell.allBranches}-${shell.canAppointAdmins}-${shell.organizationRole}`} branches={shell.branches} member={form === "new" ? undefined : form} allBranchesAllowed={shell.allBranches} canAppointAdmins={shell.canAppointAdmins} isOwner={shell.organizationRole === "owner"} onCancel={() => setForm(null)} onSaved={(status) => { setForm(null); setMessage(status ? setupMessage(status) : "User access updated."); setRevision((value) => value + 1); }} /> : null}
			{failed ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm">{t("We could not load users.")}<Button variant="outline" onClick={() => setRevision((value) => value + 1)}>{t("Try again")}</Button></div> : current?.members.length === 0 ? <p className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{t("No users found.")}</p> : (
				<UsersTable members={current?.members ?? []} branches={shell.branches} isOwner={shell.organizationRole === "owner"} loading={!current} actions={(entry) => <div className="flex flex-wrap justify-end gap-2">
					<Button variant="outline" aria-label={t("Edit access for {name}", { name: entry.user.name })} disabled={Boolean(form)} onClick={(event) => { editButtonRef.current = event.currentTarget; setMessage(null); setForm(entry); }}>{t("Edit access")}</Button>
					<Button variant="ghost" aria-label={t(entry.isActive ? "Deactivate company access for {name}" : "Reactivate company access for {name}", { name: entry.user.name })} disabled={Boolean(form || resending)} onClick={() => changeStatus(entry)}>{t(entry.isActive ? "Deactivate access" : "Reactivate access")}</Button>
					{entry.setupRequired && entry.isActive && <LoadingButton loading={resending === entry.membershipId} loadingLabel={t("Sending…")} variant="ghost" aria-label={t("Resend setup for {name}", { name: entry.user.name })} disabled={Boolean(resending)} onClick={() => void resend(entry)}>{t("Resend setup")}</LoadingButton>}
				</div>} />
			)}
		</PageContainer>
	);
}
