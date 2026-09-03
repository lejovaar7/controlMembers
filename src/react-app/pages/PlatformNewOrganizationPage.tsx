import { DEFAULT_LOCALE, languages, localeOptions, type MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { type FormEvent, useState } from "react";
import { FormMessage } from "@/components/auth-card";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENERIC_ERROR } from "@/lib/auth-errors";
import type { SetupEmailStatus } from "@/lib/members";

type Result = {
	organizationId: string;
	organizationName: string;
	ownerEmail: string;
	setupEmailStatus: SetupEmailStatus;
};

export function PlatformNewOrganizationPage() {
	const t = useT();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<MessageKey | null>(null);
	const [result, setResult] = useState<Result | null>(null);
	const [resendState, setResendState] = useState<MessageKey | null>(null);
	const [resending, setResending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const form = event.currentTarget;
		const data = new FormData(form);
		setSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/platform/organizations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companyName: String(data.get("companyName") ?? ""),
					ownerName: String(data.get("ownerName") ?? ""),
					ownerEmail: String(data.get("ownerEmail") ?? ""),
					locale: String(data.get("locale") ?? "") || null,
				}),
			});

			if (!response.ok) {
				setError(GENERIC_ERROR);
				setSubmitting(false);
				return;
			}

			setResult((await response.json()) as Result);
			form.reset();
		} catch { setError(GENERIC_ERROR); }
		finally { setSubmitting(false); }
	}

	async function handleResend() {
		if (!result || resending) return;
		setResending(true);
		setResendState(null);
		try {
			const response = await fetch("/api/platform/account-setup/resend", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: result.ownerEmail, organizationId: result.organizationId }),
			});
			if (!response.ok) throw new Error("Setup resend failed");
			const body = (await response.json()) as { sent?: boolean; };
			setResendState(
				body.sent
					? "Account setup link sent again."
					: "That owner has already finished setting up.",
			);
		} catch { setResendState("We could not send the link. Please try again."); }
		finally { setResending(false); }
	}

	if (result) {
		return (
			<PageContainer>
				<PageHeader
					title={t("Company created")}
					description={t("{company} is ready with its Main branch.", { company: result.organizationName })}
				/>
				<div className="flex flex-col gap-4">
					<FormMessage tone="success">
						{result.setupEmailStatus === "failed"
							? t("Company access is ready, but the setup email could not be sent. Please resend the link.")
							: result.setupEmailStatus === "sent"
								? t("An account setup link was sent to {email}.", { email: result.ownerEmail })
								: t("{email} already has an account and was added as owner.", { email: result.ownerEmail })}
					</FormMessage>
					<FormMessage tone="success">{resendState ? t(resendState) : null}</FormMessage>
					<div className="flex flex-wrap gap-3">
						{result.setupEmailStatus !== "not-required" ? (
							<Button variant="outline" disabled={resending} onClick={handleResend}>
								{resending ? t("Sending…") : t("Resend setup link")}
							</Button>
						) : null}
						<Button disabled={resending} onClick={() => { setResult(null); setResendState(null); setError(null); }}>
							{t("Create another")}</Button>
					</div>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title={t("Create company")}
				description={t("The company starts with one branch named Main.")}
			/>
			<form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="locale">{t("Company language")}</Label>
					<select id="locale" name="locale" defaultValue="" className="h-10 min-w-0 rounded-md border bg-background px-3">
						<option value="">{t("Application default ({language})", { language: languages[DEFAULT_LOCALE].name })}</option>
						{localeOptions.map((option) => <option key={option.value} value={option.value} lang={option.value}>{option.name}</option>)}
					</select>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="companyName">{t("Company name")}</Label>
					<Input id="companyName" name="companyName" type="text" required />
				</div>
				<div className="grid gap-2">
					<Label htmlFor="ownerName">{t("Owner name")}</Label>
					<Input
						id="ownerName"
						name="ownerName"
						type="text"
						autoComplete="name"
						required
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="ownerEmail">{t("Owner email")}</Label>
					<Input
						id="ownerEmail"
						name="ownerEmail"
						type="email"
						autoComplete="email"
						required
						aria-describedby={error ? "provision-error" : undefined}
					/>
				</div>

				<FormMessage id="provision-error">{error ? t(error) : null}</FormMessage>

				<Button type="submit" disabled={submitting}>
					{submitting ? t("Creating…") : t("Create company")}
				</Button>
			</form>
		</PageContainer>
	);
}
