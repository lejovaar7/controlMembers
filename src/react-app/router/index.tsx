import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { MembersPage } from "@/pages/MembersPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

export const router = createBrowserRouter([
	{
		element: <PublicLayout />,
		children: [
			{ index: true, element: <HomePage /> },
			{ path: "login", element: <LoginPage /> },
			{ path: "register", element: <RegisterPage /> },
			{ path: "verify-email", element: <VerifyEmailPage /> },
			{ path: "forgot-password", element: <ForgotPasswordPage /> },
			{ path: "reset-password", element: <ResetPasswordPage /> },
			{ path: "accept-invitation", element: <AcceptInvitationPage /> },
		],
	},
	{
		path: "app",
		element: <AppLayout />,
		children: [
			{ index: true, element: <Navigate to="/app/dashboard" replace /> },
			{ path: "dashboard", element: <DashboardPage /> },
			{ path: "members", element: <MembersPage /> },
			{ path: "settings", element: <SettingsPage /> },
		],
	},
	{ path: "*", element: <Navigate to="/" replace /> },
]);
