import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { PlatformLayout } from "@/layouts/PlatformLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { MembersPage } from "@/pages/MembersPage";
import { NoCompanyPage } from "@/pages/NoCompanyPage";
import { PlatformHomePage } from "@/pages/PlatformHomePage";
import { PlatformNewOrganizationPage } from "@/pages/PlatformNewOrganizationPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupAccountPage } from "@/pages/SetupAccountPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

export const router = createBrowserRouter([
	{
		element: <PublicLayout />,
		children: [
			{ index: true, element: <HomePage /> },
			{ path: "login", element: <LoginPage /> },
			{ path: "verify-email", element: <VerifyEmailPage /> },
			{ path: "forgot-password", element: <ForgotPasswordPage /> },
			{ path: "reset-password", element: <ResetPasswordPage /> },
			{ path: "setup-account", element: <SetupAccountPage /> },
			{ path: "accept-invitation", element: <AcceptInvitationPage /> },
			{ path: "no-company", element: <NoCompanyPage /> },
			// Public signup is disabled; the old route must not linger.
			{ path: "register", element: <Navigate to="/login" replace /> },
			{ path: "onboarding", element: <Navigate to="/app/dashboard" replace /> },
		],
	},
	{
		path: "platform",
		element: <PlatformLayout />,
		children: [
			{ index: true, element: <PlatformHomePage /> },
			{
				path: "organizations/new",
				element: <PlatformNewOrganizationPage />,
			},
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
