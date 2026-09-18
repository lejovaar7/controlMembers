import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { PlatformLayout } from "@/layouts/PlatformLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { BranchesPage } from "@/pages/BranchesPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { MembersPage } from "@/pages/MembersPage";
import { NoBranchAccessPage } from "@/pages/NoBranchAccessPage";
import { NoCompanyPage } from "@/pages/NoCompanyPage";
import { PlatformHomePage } from "@/pages/PlatformHomePage";
import { PlatformOrganizationPage } from "@/pages/PlatformOrganizationPage";
import { PlatformNewOrganizationPage } from "@/pages/PlatformNewOrganizationPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupAccountPage } from "@/pages/SetupAccountPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { BillingSetupPage } from "@/pages/BillingSetupPage";
import { CustomerMembersPage } from "@/pages/CustomerMembersPage";
import { CustomerMemberDetailPage } from "@/pages/CustomerMemberDetailPage";
import { CollectionsPage, LegacyCollectionsRedirect } from "@/pages/CollectionsPage";
import { ReportsPage } from "@/pages/ReportsPage";

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
			{ path: "organizations/:id", element: <PlatformOrganizationPage /> },
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
			{ path: "billing-setup", element: <BillingSetupPage /> },
			{ path: "customer-members", element: <CustomerMembersPage /> },
			{ path: "customer-members/:id", element: <CustomerMemberDetailPage /> },
			{ path: "collections", element: <Navigate to="/app/collections/fees" replace /> },
			{ path: "collections/:section", element: <CollectionsPage /> },
			{ path: "charges", element: <LegacyCollectionsRedirect view="fees" /> },
			{ path: "payments", element: <LegacyCollectionsRedirect view="payments" /> },
			{ path: "reports", element: <ReportsPage /> },
			{ path: "branches", element: <BranchesPage /> },
			{ path: "no-branch-access", element: <NoBranchAccessPage /> },
			{ path: "members", element: <MembersPage /> },
			{ path: "users", element: <Navigate to="/app/members" replace /> },
			{ path: "settings", element: <SettingsPage /> },
		],
	},
	{ path: "*", element: <Navigate to="/" replace /> },
]);
