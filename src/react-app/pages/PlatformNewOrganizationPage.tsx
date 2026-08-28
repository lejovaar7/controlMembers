import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { FormMessage } from "@/components/auth-card";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENERIC_ERROR } from "@/lib/auth-errors";

type Result = {
	organizationName: string;
	ownerEmail: string;
	setupEmailSent: boolean;
};

export function PlatformNewOrganizationPage() {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<Result | null>(null);
	const [resendState, setResendState] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const form = event.currentTarget;
		const data = new FormData(form);
		setSubmitting(true);
		setError(null);

		const response = await fetch("/api/platform/organizations", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				companyName: String(data.get("companyName") ?? ""),
				ownerName: String(data.get("ownerName") ?? ""),
				ownerEmail: String(data.get("ownerEmail") ?? ""),
			}),
		});

		if (!response.ok) {
			setError(GENERIC_ERROR);
			setSubmitting(false);
			return;
		}

		setResult((await response.json()) as Result);
		form.reset();
		setSubmitting(false);
	}

	async function handleResend() {
		if (!result) return;
		setResendState(null);
		const response = await fetch("/api/platform/account-setup/resend", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: result.ownerEmail }),
		});
		const body = (await response.json()) as { sent?: boolean };
		setResendState(
			body.sent
				? "Account setup link sent again."
				: "That owner has already finished setting up.",
		);
	}

	if (result) {
		return (
			<PageContainer>
				<PageHeader
					title="Company created"
					description={`${result.organizationName} is ready with its Main branch.`}
				/>
				<div className="flex flex-col gap-4">
					<FormMessage tone="success">
						{result.setupEmailSent
							? `An account setup link was sent to ${result.ownerEmail}.`
							: `${result.ownerEmail} already has an account and was added as owner.`}
					</FormMessage>
					<FormMessage tone="success">{resendState}</FormMessage>
					<div className="flex gap-3">
						{result.setupEmailSent ? (
							<Button variant="outline" onClick={handleResend}>
								Resend setup link
							</Button>
						) : null}
						<Button render={<Link to="/platform/organizations/new" />}>
							Create another
						</Button>
					</div>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Create company"
				description="The company starts with one branch named Main."
			/>
			<form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="companyName">Company name</Label>
					<Input id="companyName" name="companyName" type="text" required />
				</div>
				<div className="grid gap-2">
					<Label htmlFor="ownerName">Owner name</Label>
					<Input
						id="ownerName"
						name="ownerName"
						type="text"
						autoComplete="name"
						required
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="ownerEmail">Owner email</Label>
					<Input
						id="ownerEmail"
						name="ownerEmail"
						type="email"
						autoComplete="email"
						required
						aria-describedby={error ? "provision-error" : undefined}
					/>
				</div>

				<FormMessage id="provision-error">{error}</FormMessage>

				<Button type="submit" disabled={submitting}>
					{submitting ? "Creating\u2026" : "Create company"}
				</Button>
			</form>
		</PageContainer>
	);
}
