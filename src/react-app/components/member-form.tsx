import { SelectField } from "@/components/select-field";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { LoadingButton } from "@/components/loading-button";
import type { MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branch } from "@/hooks/use-branches";
import type { MemberAccess, MemberSummary, SetupEmailStatus } from "@/lib/members";

export function MemberForm({ branches, member, allBranchesAllowed, canAppointAdmins, isOwner, onSaved, onCancel, inDialog = false, returnFocus }: {
	inDialog?: boolean;
	returnFocus?: DialogReturnFocus;
	branches: Branch[];
	member?: MemberSummary;
	allBranchesAllowed: boolean;
	canAppointAdmins: boolean;
	isOwner: boolean;
	onSaved: (status?: SetupEmailStatus) => void;
	onCancel: () => void;
}) {
	const t = useT();
	const id = useId();
	const [role, setRole] = useState<"member" | "admin">(member?.role === "admin" ? "admin" : "member");
	const [selected, setSelected] = useState<string[]>(member?.branchAccess.kind === "assigned-branches" ? member.branchAccess.branchIds : []);
	const [allBranches, setAllBranches] = useState(member ? member.branchAccess.kind === "all-branches" : allBranchesAllowed);
	const [appointmentPermission, setAppointmentPermission] = useState(member?.canAppointAdmins ?? false);
	const [financialPermissions, setFinancialPermissions] = useState({
		canReversePayments: member?.canReversePayments ?? false,
		canAdjustCharges: member?.canAdjustCharges ?? false,
		canViewReports: member?.canViewReports ?? false,
		canExportFinancialData: member?.canExportFinancialData ?? false,
	});
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<MessageKey | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) return;
		const grantsAllBranches = role === "admin" && allBranches;
		if (!grantsAllBranches && !selected.length) { setError("Select at least one branch."); return; }
		const form = new FormData(event.currentTarget);
		const access: MemberAccess = {
			role, branchIds: grantsAllBranches ? [] : selected, allBranches: grantsAllBranches,
			...(isOwner ? { canAppointAdmins: role === "admin" && appointmentPermission } : {}),
			...(isOwner ? financialPermissions : {}),
		};
		setPending(true);
		setError(null);
		try {
			const response = await fetch(member ? `/api/members/${encodeURIComponent(member.membershipId)}` : "/api/members", {
				method: member ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(member ? access : { ...access, name: String(form.get("name") ?? "").trim(), email: String(form.get("email") ?? "").trim() }),
			});
			if (!response.ok) throw new Error("Could not save access");
			const result = await response.json() as { setupEmailStatus?: SetupEmailStatus; };
			onSaved(result.setupEmailStatus);
		} catch { setError("We could not save this user. Check their role and branches, then try again. Retrying will not create a duplicate user."); }
		finally { setPending(false); }
	}

	const formContent = <form onSubmit={submit} className={inDialog ? "grid gap-5 px-5 pt-5 sm:px-7" : "grid max-w-3xl gap-5 rounded-xl border bg-card p-5 sm:p-6"} aria-busy={pending} aria-label={member ? t("Edit access for {name}", { name: member.user.name }) : t("Add user")}>
		{!inDialog && <h2 className="break-words font-medium">{member ? t("Edit access: {name}", { name: member.user.name }) : t("Add user")}</h2>}
		<fieldset disabled={pending} className="grid gap-4">
			{!member && <>
				<div className="grid gap-2"><Label htmlFor={`${id}-name`}>{t("Name")}</Label><Input id={`${id}-name`} name="name" autoComplete="name" maxLength={200} autoFocus={!inDialog} required /></div>
				<div className="grid gap-2"><Label htmlFor={`${id}-email`}>{t("Email")}</Label><Input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required /></div>
			</>}
			<div className="grid gap-2">
				<Label htmlFor={`${id}-role`}>{t("Company role")}</Label>
				<SelectField id={`${id}-role`} autoFocus={Boolean(member) && !inDialog} className="h-11 rounded-md border bg-background px-3 " value={role} onValueChange={(value) => setRole(value as "member" | "admin")} options={[{ value: "member", label: t("User") }, ...(canAppointAdmins ? [{ value: "admin", label: t("Admin") }] : [])]} />
			</div>
			{role === "admin" && allBranchesAllowed && <div className="grid gap-2">
				<Label htmlFor={`${id}-scope`}>{t("Branch access")}</Label>
				<SelectField id={`${id}-scope`} className="h-11 rounded-md border bg-background px-3 " value={allBranches ? "all" : "assigned"} onValueChange={(value) => setAllBranches(value === "all")} options={[{ value: "all", label: t("All current and future branches") }, { value: "assigned", label: t("Selected branches only") }]} />
			</div>}
			{role === "admin" && allBranches ? <p className="text-sm text-muted-foreground">{t("Access includes every current and future branch in this company.")}</p> : <fieldset className="grid gap-2" aria-describedby={`${id}-branches-help`}>
				<legend className="mb-2 font-medium text-sm">{t("Branches")}</legend>
				<p id={`${id}-branches-help`} className="text-sm text-muted-foreground">{t("Select at least one branch.")}</p>
				{branches.map((branch) => <label key={branch.id} className="flex min-h-10 items-center gap-3 text-sm">
					<input type="checkbox" className="size-4 shrink-0 accent-primary" checked={selected.includes(branch.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, branch.id] : ids.filter((item) => item !== branch.id))} /><span className="min-w-0 break-words">{branch.name}</span>
				</label>)}
			</fieldset>}
			{role === "admin" && isOwner && <label className="flex items-start gap-3 text-sm">
				<input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={appointmentPermission} onChange={(event) => setAppointmentPermission(event.target.checked)} />
				<span>{t("Can appoint administrators")}<span className="mt-1 block text-muted-foreground">{t("Allows creating or promoting admins within their branch scope. Only the owner can grant this permission. It does not allow editing other admins.")}</span></span>
			</label>}
			{isOwner && <fieldset className="grid gap-3 rounded-lg border p-3">
				<legend className="px-1 text-sm font-medium">{t("Financial permissions")}</legend>
				<p className="text-sm text-muted-foreground">{t("These permissions do not expand the user's branch access.")}</p>
				<PermissionCheckbox label={t("Can cancel payments")} checked={financialPermissions.canReversePayments} onChange={(checked) => setFinancialPermissions((current) => ({ ...current, canReversePayments: checked }))} />
				<PermissionCheckbox label={t("Can adjust or void charges")} checked={financialPermissions.canAdjustCharges} onChange={(checked) => setFinancialPermissions((current) => ({ ...current, canAdjustCharges: checked }))} />
				<PermissionCheckbox label={t("Can view financial reports")} checked={financialPermissions.canViewReports} onChange={(checked) => setFinancialPermissions((current) => ({ ...current, canViewReports: checked }))} />
				<PermissionCheckbox label={t("Can export financial data")} checked={financialPermissions.canExportFinancialData} onChange={(checked) => setFinancialPermissions((current) => ({ ...current, canExportFinancialData: checked }))} />
			</fieldset>}
			{!member && <p className="text-sm text-muted-foreground">{t("New users receive a secure link to choose their own password. Existing accounts keep their sign-in details.")}</p>}
		</fieldset>
		{error && <p role="alert" className="text-sm text-destructive">{error ? t(error) : null}</p>}
		<div className={inDialog ? "-mx-5 flex flex-col gap-2 border-t bg-muted/30 px-5 py-4 sm:-mx-7 sm:flex-row-reverse sm:px-7" : "flex flex-wrap gap-2"}><LoadingButton loading={pending} loadingLabel={t("Saving…")} type="submit" disabled={pending}>{member ? t("Save access") : t("Add user")}</LoadingButton><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t("Cancel")}</Button></div>
	</form>;
	return inDialog ? <CenteredDialog open title={member ? t("Edit access: {name}", { name: member.user.name }) : t("Add user")} description={t("Manage who can sign in to the system and what actions they can perform.")} pending={pending} onClose={onCancel} returnFocus={returnFocus} wide>{formContent}</CenteredDialog> : formContent;
}

function PermissionCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
	return <label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" className="size-4 shrink-0 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
