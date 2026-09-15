import { useT } from "@/lib/i18n";
import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { authenticatedStartPath } from "@/lib/session-routing";

export function HomePage() {
	const t = useT();
	const { data: session, isPending } = useSession();

	return (
		<PageContainer>
			<PageHeader
				title={t("ControlMembers")}
				description={t("Simple recurring fee control for membership organizations.")}
			/>
			{isPending ? null : session ? (
				<Button nativeButton={false} render={<Link to={authenticatedStartPath(null, (session.user as { role?: unknown }).role)} />}>{t("Open app")}</Button>
			) : (
				<Button nativeButton={false} render={<Link to="/login" />}>{t("Sign in")}</Button>
			)}
		</PageContainer>
	);
}
