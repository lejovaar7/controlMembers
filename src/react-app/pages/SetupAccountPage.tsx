import type { MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth-client";
import { GENERIC_ERROR } from "@/lib/auth-errors";
import { authenticatedStartPath } from "@/lib/session-routing";

/**
 * First-time credential setup. The magic link has already authenticated the
 * user; this page only sets a password. It never creates an organization or a
 * branch — those are provisioned before the link is sent.
 */
export function SetupAccountPage() {
	const t = useT();
	const { data: session, isPending } = useSession();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<MessageKey | null>(null);

	if (isPending) return null;

	if (!session) {
		return (
			<AuthCard
				title={t("Setup link problem")}
				description={t("This setup link is invalid or has expired.")}
				footer={<Link to="/login" className="underline">{t("Go to sign in")}</Link>}
			>
				{null}
			</AuthCard>
		);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const form = event.currentTarget;
		const data = new FormData(form);
		const newPassword = String(data.get("newPassword") ?? "");
		const confirmPassword = String(data.get("confirmPassword") ?? "");

		if (newPassword !== confirmPassword) {
			setError("Those passwords do not match.");
			return;
		}

		setSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/account/setup-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPassword }),
			});
			form.reset();

			if (!response.ok) {
				setError(response.status === 409 ? "Your password is already configured. Sign in with your existing password or use password recovery." : GENERIC_ERROR);
				setSubmitting(false);
				return;
			}

			// A full load picks up the refreshed session. Platform admins have no
			// company of their own, so they go to platform administration instead.
			const role = (session?.user as { role?: unknown; } | undefined)?.role;
			window.location.assign(authenticatedStartPath(null, role));
		} catch { setError(GENERIC_ERROR); }
		finally { form.reset(); setSubmitting(false); }
	}

	return (
		<AuthCard
			title={t("Choose your password")}
			description={t("Your email is confirmed. Pick a password to finish setting up your account.")}
			footer={<Link to="/login" className="underline">{t("Go to sign in")}</Link>}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="newPassword">{t("New password")}</Label>
					<Input
						id="newPassword"
						name="newPassword"
						type="password"
						autoComplete="new-password"
						minLength={8}
						maxLength={128}
						required
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="confirmPassword">{t("Confirm password")}</Label>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						minLength={8}
						required
						aria-describedby={error ? "setup-error" : undefined}
					/>
				</div>

				<FormMessage id="setup-error">{error ? t(error) : null}</FormMessage>

				<Button type="submit" disabled={submitting}>
					{submitting ? t("Saving…") : t("Save password")}
				</Button>
			</form>
		</AuthCard>
	);
}
