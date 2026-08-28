import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function RegisterPage() {
	const { data: session, isPending: sessionPending } = useSession();
	const navigate = useNavigate();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (sessionPending) return null;
	if (session) return <Navigate to="/app/dashboard" replace />;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const form = event.currentTarget;
		const data = new FormData(form);
		const password = String(data.get("password") ?? "");
		const confirmPassword = String(data.get("confirmPassword") ?? "");

		if (password !== confirmPassword) {
			setError("Those passwords do not match.");
			return;
		}

		setSubmitting(true);
		setError(null);

		// Better Auth sends the verification email and returns no session,
		// because the backend requires a verified address before sign-in.
		const { error: signUpError } = await authClient.signUp.email({
			name,
			email,
			password,
			callbackURL: "/verify-email?verified=1",
		});

		if (signUpError) {
			setError(authErrorMessage(signUpError));
			setSubmitting(false);
			return;
		}

		navigate(`/verify-email?sent=${encodeURIComponent(email)}`, {
			replace: true,
		});
	}

	return (
		<AuthCard
			title="Create account"
			description="We will email you a link to confirm your address."
			footer={
				<>
					Already registered? <Link to="/login" className="underline">Sign in</Link>
				</>
			}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="name">Name</Label>
					<Input
						id="name"
						name="name"
						type="text"
						autoComplete="name"
						required
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>

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
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						required
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="confirmPassword">Confirm password</Label>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						required
						aria-describedby={error ? "register-error" : undefined}
					/>
				</div>

				<FormMessage id="register-error">{error}</FormMessage>

				<Button type="submit" disabled={submitting}>
					{submitting ? "Creating account\u2026" : "Create account"}
				</Button>
			</form>
		</AuthCard>
	);
}
