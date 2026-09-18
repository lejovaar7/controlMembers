import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { MapPin, Pencil, Plus, Search } from "lucide-react";
import { CenteredDialog } from "@/components/centered-dialog";
import { LoadingButton } from "@/components/loading-button";
import { StatusBadge } from "@/components/status-badge";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import type { Branch } from "@/hooks/use-branches";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

/** Presentation only: Better Auth and the Worker retain Branch authorization. */
export function BranchesPage() {
	const shell = useAppShell();
	if (!shell.canManageBranches) return <Navigate to="/app/dashboard" replace />;
	return <BranchWorkspace key={shell.organizationId} />;
}

function BranchWorkspace() {
	const { locale, t } = useI18n();
	const shell = useAppShell();
	const [search, setSearch] = useState("");
	const [editor, setEditor] = useState<{ branch: Branch | null; trigger: HTMLElement } | null>(null);
	const [saved, setSaved] = useState<"Branch created." | "Branch name updated." | null>(null);
	const query = search.trim().toLocaleLowerCase(locale);
	const branches = shell.branches.filter((branch) => branch.name.toLocaleLowerCase(locale).includes(query))
		.sort((a, b) => Number(b.id === shell.activeBranch?.id) - Number(a.id === shell.activeBranch?.id) || a.name.localeCompare(b.name, locale));
	function openEditor(branch: Branch | null, trigger: HTMLElement) { setSaved(null); setEditor({ branch, trigger }); }

	return <PageContainer className="space-y-6">
		<PageHeader title={t("Branches")} description={t("Organize your locations and identify where you are working.")} actions={shell.canCreateBranches ? <Button onClick={(event) => openEditor(null, event.currentTarget)}><Plus aria-hidden="true" />{t("Add branch")}</Button> : null} />
		{saved ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(saved)}</p> : null}
		{shell.activeBranch ? <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"><div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><MapPin className="size-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{t("Current branch")}</p><p className="mt-1 text-base font-semibold break-words">{shell.activeBranch.name}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t(shell.branches.length > 1 ? "Use the branch selector in the top bar to change your workspace." : "Members, plans and payments are organized in this branch.")}</p></div></div> : null}
		<div className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm"><Label htmlFor="branch-search">{t("Search branches")}</Label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="branch-search" className="pl-10" value={search} placeholder={t("Search by branch name")} onChange={(event) => setSearch(event.target.value)} /></div></div>
		<section className="space-y-4" aria-labelledby="branch-list-title">
			<div className="flex flex-wrap items-center justify-between gap-2"><h2 id="branch-list-title" className="text-base font-semibold">{t("Your branches")}</h2><span className="text-sm text-muted-foreground">{t(branches.length === 1 ? "{count} branch" : "{count} branches", { count: branches.length })}</span></div>
			{branches.length ? <div className="member-directory rounded-2xl border bg-card shadow-sm">
				<table className="members-table branches-table" role="table">
					<caption className="sr-only">{t("Your branches")}</caption>
					<thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">{t("Branch name")}</th><th scope="col" role="columnheader" className="branch-actions">{t("Actions")}</th></tr></thead>
					<tbody role="rowgroup">{branches.map((branch) => <tr key={branch.id} role="row">
						<td role="cell" className="member-name" data-label={t("Branch name")}><div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"><span className="font-semibold">{branch.name}</span>{branch.id === shell.activeBranch?.id ? <StatusBadge tone="success">{t("Current branch")}</StatusBadge> : null}</div></td>
						<td role="cell" className="branch-actions" data-label={t("Actions")}><Button variant="outline" onClick={(event) => openEditor(branch, event.currentTarget)} aria-label={t("Edit name of {branch}", { branch: branch.name })}><Pencil aria-hidden="true" />{t("Edit name")}</Button></td>
					</tr>)}</tbody>
				</table>
			</div> : <div className="space-y-3 rounded-2xl border border-dashed bg-card px-5 py-12 text-center"><h3 className="text-lg font-semibold">{t(shell.branches.length ? "No matching branches" : "No branches available")}</h3><p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{t(shell.branches.length ? "Try another branch name or clear the search." : "Your accessible branches will appear here.")}</p>{search ? <Button variant="outline" onClick={() => setSearch("")}>{t("Clear search")}</Button> : shell.canCreateBranches ? <Button onClick={(event) => openEditor(null, event.currentTarget)}><Plus aria-hidden="true" />{t("Add branch")}</Button> : null}</div>}
		</section>
		{!shell.canCreateBranches ? <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm leading-6 text-muted-foreground">{t("You can rename your assigned branches. Creating a new branch requires company-wide administration.")}</p> : null}
		{editor ? <BranchEditor branch={editor.branch} returnFocus={editor.trigger} onClose={() => setEditor(null)} onSaved={() => { setSaved(editor.branch ? "Branch name updated." : "Branch created."); setSearch(""); setEditor(null); shell.refreshBranches(); }} /> : null}
	</PageContainer>;
}

function BranchEditor({ branch, returnFocus, onClose, onSaved }: { branch: Branch | null; returnFocus: HTMLElement; onClose: () => void; onSaved: () => void }) {
	const { t } = useI18n();
	const shell = useAppShell();
	const [name, setName] = useState(branch?.name ?? "");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending || !name.trim()) return;
		setPending(true); setFailed(false);
		try {
			const result = branch ? await authClient.organization.updateTeam({ teamId: branch.id, data: { name: name.trim() } }) : await authClient.organization.createTeam({ name: name.trim(), organizationId: shell.organizationId });
			if (result.error) setFailed(true);
			else onSaved();
		} catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <CenteredDialog open title={t(branch ? "Edit branch name" : "Add branch")} description={t(branch ? "Changing the name keeps this branch's members, plans and payments." : "Choose a clear name so your team can easily identify this location.")} pending={pending} returnFocus={returnFocus} onClose={onClose}>
		<form onSubmit={submit} className="space-y-5 px-5 pt-5 pb-6 sm:px-7 sm:pb-7">
			<div className="grid gap-2"><Label htmlFor="branch-name">{t("Branch name")}</Label><Input id="branch-name" name="branchName" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} disabled={pending} placeholder={t("For example: North branch")} aria-describedby={failed ? "branch-save-error" : undefined} /></div>
			{failed ? <p id="branch-save-error" role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{t("We could not save the branch. Please try again.")}</p> : null}
			<div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !name.trim() || (branch !== null && name.trim() === branch.name)}>{t(branch ? "Save changes" : "Add branch")}</LoadingButton></div>
		</form>
	</CenteredDialog>;
}
