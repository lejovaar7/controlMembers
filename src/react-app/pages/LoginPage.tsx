import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { authErrorMessage, isEmailNotVerified } from "@/lib/auth-errors";
import { safeReturnPath } from "@/lib/return-path";

export function LoginPage() {
	const { data: session, isPending: sessionPending } = useSession();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [needsVerification, setNeedsVerification] = useState(false);

	const returnTo = safeReturnPath(searchParams.get("returnTo"));
	const justReset = searchParams.get("reset") === "success";

	if (sessionPending) return null;
	if (session) return <Navigate to={returnTo} replace />;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const form = event.currentTarget;
		const password = new FormData(form).get("password");
		setSubmitting(true);
		setError(null);
		setNeedsVerification(false);

		const { error: signInError } = await authClient.signIn.email({
			email,
			password: String(password ?? ""),
		}).catch(() => ({ error: { code: "NETWORK_ERROR" } }));

		if (signInError) {
			setNeedsVerification(isEmailNotVerified(signInError));
			setError(authErrorMessage(signInError));
			form.reset();
			setSubmitting(false);
			return;
		}

		navigate(returnTo, { replace: true });
	}

	return (
		<AuthCard
			title="Sign in"
			description="Use your email and password."
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				{justReset ? (
					<FormMessage tone="success">
						Your password was changed. Sign in with your new password.
					</FormMessage>
				) : null}

				<div className="grid gap-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						aria-describedby={error ? "login-error" : undefined}
					/>
				</div>

				<div className="grid gap-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="password">Password</Label>
						<Link to="/forgot-password" className="text-muted-foreground text-sm underline">
							Forgot?
						</Link>
					</div>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
						aria-describedby={error ? "login-error" : undefined}
					/>
				</div>

				<FormMessage id="login-error">{error}</FormMessage>
				{needsVerification ? (
					<p className="text-sm">
						<Link to="/verify-email" className="underline">
							Resend the verification email
						</Link>
					</p>
				) : null}

				<Button type="submit" disabled={submitting}>
					{submitting ? "Signing in\u2026" : "Sign in"}
				</Button>
			</form>
		</AuthCard>
	);
}
