import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branch } from "@/hooks/use-branches";
import type { MemberAccess, MemberSummary, SetupEmailStatus } from "@/lib/members";

export function MemberForm({ branches, member, onSaved, onCancel }: {
	branches: Branch[];
	member?: MemberSummary;
	onSaved: (status?: SetupEmailStatus) => void;
	onCancel: () => void;
}) {
	const id = useId();
	const [role, setRole] = useState<"member" | "admin">(member?.role === "admin" ? "admin" : "member");
	const [selected, setSelected] = useState<string[]>(member?.branchAccess.kind === "assigned-branches" ? member.branchAccess.branchIds : []);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) return;
		if (role === "member" && !selected.length) { setError("Select at least one branch."); return; }
		const form = new FormData(event.currentTarget);
		const access: MemberAccess = { role, branchIds: role === "member" ? selected : [] };
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
		} catch { setError("We could not save this member. Check their role and branches, then try again. Retrying will not create a duplicate member."); }
		finally { setPending(false); }
	}

	return <form onSubmit={submit} className="grid gap-4 rounded-lg border p-4" aria-label={member ? `Edit access for ${member.user.name}` : "Add member"}>
		<h2 className="break-words font-medium">{member ? `Edit access: ${member.user.name}` : "Add member"}</h2>
		<fieldset disabled={pending} className="grid gap-4">
			{!member && <>
				<div className="grid gap-2"><Label htmlFor={`${id}-name`}>Name</Label><Input id={`${id}-name`} name="name" autoComplete="name" maxLength={200} autoFocus required /></div>
				<div className="grid gap-2"><Label htmlFor={`${id}-email`}>Email</Label><Input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required /></div>
			</>}
			<div className="grid gap-2">
				<Label htmlFor={`${id}-role`}>Company role</Label>
				<select id={`${id}-role`} autoFocus={Boolean(member)} className="h-10 rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" value={role} onChange={(event) => setRole(event.target.value as "member" | "admin")}>
					<option value="member">Member</option><option value="admin">Admin</option>
				</select>
			</div>
			{role === "admin" ? <p className="text-sm text-muted-foreground">Admins can access all branches in this company.</p> : <fieldset className="grid gap-2" aria-describedby={`${id}-branches-help`}>
				<legend className="mb-2 font-medium text-sm">Branches</legend>
				<p id={`${id}-branches-help`} className="text-sm text-muted-foreground">Select at least one branch.</p>
				{branches.map((branch) => <label key={branch.id} className="flex min-h-10 items-center gap-3 text-sm">
					<input type="checkbox" className="size-4 shrink-0 accent-primary" checked={selected.includes(branch.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, branch.id] : ids.filter((item) => item !== branch.id))} /><span className="min-w-0 break-words">{branch.name}</span>
				</label>)}
			</fieldset>}
			{!member && <p className="text-sm text-muted-foreground">New users receive a secure link to choose their own password. Existing accounts keep their sign-in details.</p>}
		</fieldset>
		{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
		<div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : member ? "Save access" : "Add member"}</Button><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button></div>
	</form>;
}
