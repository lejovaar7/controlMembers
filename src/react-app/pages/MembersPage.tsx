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
	return <MemberWorkspace key={shell.organizationId} />;
}

function MemberWorkspace() {
	const shell = useAppShell();
	const [directory, setDirectory] = useState<MemberDirectory | null>(null);
	const [failed, setFailed] = useState(false);
	const [revision, setRevision] = useState(0);
	const [form, setForm] = useState<MemberSummary | "new" | null>(null);
	const [message, setMessage] = useState<string | null>(null);
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
	}, [shell.organizationId, shell.canManageBranches, revision]);

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
			<PageHeader title="Members" description="People and access in this company." />
			{message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
			{form ? <MemberForm key={form === "new" ? "new" : form.membershipId} branches={shell.branches} member={form === "new" ? undefined : form} onCancel={() => setForm(null)} onSaved={(status) => { setForm(null); setMessage(status ? setupMessage(status) : "Member access updated."); setRevision((value) => value + 1); }} /> : <div><Button onClick={() => { setMessage(null); setForm("new"); }}>Add member</Button></div>}
			{failed ? <div role="alert">We could not load members. <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></div> : !current ? <p role="status">Loading members…</p> : current.members.length === 0 ? <p>No members found.</p> : (
				<ul className="grid gap-3">
					{current.members.map((entry) => (
						<li key={entry.membershipId} className="rounded-lg border p-4">
							<h2 className="break-words font-medium">{entry.user.name}</h2>
							<p className="text-muted-foreground break-all text-sm">{entry.user.email}</p>
							<p className="mt-2 text-sm">Role: {entry.role}</p>
							<p className="text-sm">{entry.branchAccess.kind === "all-branches" ? "All branches" : entry.branchAccess.branchIds.map((id) => shell.branches.find((branch) => branch.id === id)?.name).filter(Boolean).join(", ") || "No branch access"}</p>
							{entry.setupRequired && <p className="mt-1 text-sm text-muted-foreground">Account setup pending</p>}
							{entry.canManage && <div className="mt-3 flex flex-wrap gap-2">
								<Button variant="outline" aria-label={`Edit access for ${entry.user.name}`} disabled={Boolean(form)} onClick={() => { setMessage(null); setForm(entry); }}>Edit access</Button>
								{entry.setupRequired && <Button variant="outline" aria-label={`Resend setup for ${entry.user.name}`} disabled={Boolean(resending)} onClick={() => void resend(entry)}>{resending === entry.membershipId ? "Sending…" : "Resend setup"}</Button>}
							</div>}
						</li>
					))}
				</ul>
			)}
		</PageContainer>
	);
}
