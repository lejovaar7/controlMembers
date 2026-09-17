import { LoadingButton } from "@/components/loading-button";
import type { MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { FormMessage } from "@/components/auth-card";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { authClient } from "@/lib/auth-client";
import { GENERIC_ERROR } from "@/lib/auth-errors";

/**
 * Branch administration for owners and admins.
 *
 * Creation and renaming go through Better Auth's Team APIs, which already
 * enforce the organization role server-side — a member calling them directly is
 * refused regardless of what this page renders.
 */
export function BranchesPage() {
	const shell = useAppShell();
	if (!shell.canManageBranches) return <Navigate to="/app/dashboard" replace />;
	return <BranchWorkspace key={shell.organizationId} />;
}

function BranchWorkspace() {
	const t = useT();
	const shell = useAppShell();
	const [name, setName] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<MessageKey | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");

	async function handleCreate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting || !name.trim()) return;
		setSubmitting(true);
		setError(null);

		try {
			const { error: createError } = await authClient.organization.createTeam({
				name: name.trim(),
				organizationId: shell.organizationId,
			});

			if (createError) {
				setError(GENERIC_ERROR);
				setSubmitting(false);
				return;
			}

			setName("");
			setSubmitting(false);
			shell.refreshBranches();
		} catch {
			setError(GENERIC_ERROR);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleRename(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!renamingId || submitting || !renameValue.trim()) return;
		setSubmitting(true);
		setError(null);

		try {
			const { error: updateError } = await authClient.organization.updateTeam({
				teamId: renamingId,
				data: { name: renameValue.trim() },
			});

			if (updateError) {
				setError(GENERIC_ERROR);
				setSubmitting(false);
				return;
			}

			setRenamingId(null);
			setRenameValue("");
			setSubmitting(false);
			shell.refreshBranches();
		} catch {
			setError(GENERIC_ERROR);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<PageContainer>
			<PageHeader
				title={t("Branches")}
				description={t("The locations this company operates.")}
			/>

			<ul className="mb-8 flex flex-col gap-2">
				{shell.branches.map((branch) => (
					<li
						key={branch.id}
						className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5"
					>
						{renamingId === branch.id ? (
							<form
								onSubmit={handleRename}
								className="flex flex-wrap items-end gap-2"
							>
								<div className="grid gap-1">
									<Label htmlFor={`rename-${branch.id}`}>{t("Branch name")}</Label>
									<Input
										id={`rename-${branch.id}`}
										value={renameValue}
										onChange={(event) => setRenameValue(event.target.value)}
										required
										maxLength={100}
									/>
								</div>
								<LoadingButton loading={submitting}
									type="submit"
									size="sm"
									disabled={submitting || renameValue.trim().length === 0}
								>
									{t("Save")}</LoadingButton>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setRenamingId(null)}
								>
									{t("Cancel")}</Button>
							</form>
						) : (
							<>
								<span className="font-medium">
									{branch.name}
									{shell.activeBranch?.id === branch.id ? (
										<span className="text-muted-foreground ml-2 text-sm font-normal">
											{t("Active")}</span>
									) : null}
								</span>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										setRenamingId(branch.id);
										setRenameValue(branch.name);
									}}
								>
									{t("Rename")}</Button>
							</>
						)}
					</li>
				))}
			</ul>

			{shell.canCreateBranches ? <form onSubmit={handleCreate} className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-6">
				<div className="grid gap-2">
					<Label htmlFor="branchName">{t("New branch name")}</Label>
					<Input
						id="branchName"
						name="branchName"
						type="text"
						required
						maxLength={100}
						value={name}
						onChange={(event) => setName(event.target.value)}
						aria-describedby={error ? "branch-error" : undefined}
					/>
				</div>

				<FormMessage id="branch-error">{error ? t(error) : null}</FormMessage>

				<LoadingButton loading={submitting} loadingLabel={t("Saving…")} type="submit" disabled={submitting || name.trim().length === 0}>
					{t("Add branch")}
				</LoadingButton>
			</form> : <p className="text-sm text-muted-foreground">{t("You can rename your assigned branches. Creating a new branch requires company-wide administration.")}</p>}
		</PageContainer>
	);
}
