import { useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { Plus } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { GenerateFeesDialog } from "@/components/generate-fees-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { useAppShell } from "@/hooks/use-app-shell";
import { useT } from "@/lib/i18n";
import { legacyCollectionUrl, type CollectionView } from "@/lib/collections-navigation";
import { cn } from "@/lib/utils";
import { ChargesPage } from "@/pages/ChargesPage";
import { PaymentsPage } from "@/pages/PaymentsPage";

export function LegacyCollectionsRedirect({ view }: { view: CollectionView }) {
	return <Navigate replace to={legacyCollectionUrl(view, useLocation().search)} />;
}

export function CollectionsPage() {
	const shell = useAppShell();
	return <CollectionsWorkspace key={`${shell.organizationId}:${shell.activeBranch?.id}`} />;
}

function CollectionsWorkspace() {
	const { section } = useParams(); const location = useLocation(); const shell = useAppShell(); const t = useT();
	const [queries, setQueries] = useState({ fees: "", payments: "" });
	const [revision, setRevision] = useState(0);
	const [payment, setPayment] = useState<{ memberId?: string; chargeId?: string; trigger: HTMLElement } | null>(null);
	const [generation, setGeneration] = useState<HTMLElement | null>(null);
	const [receipt, setReceipt] = useState<string | null>(null);
	const [generated, setGenerated] = useState<{ created: number; alreadyExisting: number } | null>(null);
	if (section !== "fees" && section !== "payments") return <Navigate to="/app/collections/fees" replace />;
	return <PageContainer className="space-y-5">
		<PageHeader title={t("Collections & payments")} description={t("Review fees and record the money received in this branch.")} actions={<>
			{section === "fees" && ["owner", "admin"].includes(shell.organizationRole ?? "") ? <Button variant="outline" onClick={(event) => setGeneration(event.currentTarget)}>{t("Generate monthly charges")}</Button> : null}
			<Button onClick={(event) => { setReceipt(null); setPayment({ trigger: event.currentTarget }); }}><Plus aria-hidden="true" />{t("Record payment")}</Button>
		</>} />
		<nav aria-label={t("Collections & payments")} className="flex w-full gap-1 rounded-xl border bg-muted/40 p-1 sm:w-fit">
			{(["fees", "payments"] as const).map((view) => <Link key={view} to={`/app/collections/${view}${view === section ? location.search : queries[view]}`} aria-current={view === section ? "page" : undefined} onClick={() => setQueries((current) => ({ ...current, [section]: location.search }))} className={cn("flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-center text-sm font-medium sm:flex-none sm:px-5", view === section ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60")}>{t(view === "fees" ? "Monthly fees" : "Received payments")}</Link>)}
		</nav>
		{receipt ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{t("Payment recorded. Receipt: {receipt}", { receipt })}</p> : null}
		{generated ? <p role="status" className="rounded-xl border bg-card p-4 text-sm">{t("Created: {created}. Already existed: {existing}.", { created: generated.created, existing: generated.alreadyExisting })}</p> : null}
		{section === "fees" ? <ChargesPage revision={revision} onPay={(charge, trigger) => { setReceipt(null); setPayment({ memberId: charge.memberId, chargeId: charge.id, trigger }); }} /> : <PaymentsPage revision={revision} />}
		{payment ? <PaymentDialog memberId={payment.memberId} chargeId={payment.chargeId} returnFocus={payment.trigger} onClose={() => setPayment(null)} onSaved={(result) => { setReceipt(result.receiptNumber); setPayment(null); setRevision((value) => value + 1); }} /> : null}
		{generation ? <GenerateFeesDialog trigger={generation} onClose={() => setGeneration(null)} onSaved={(result) => { setGenerated(result); setGeneration(null); setRevision((value) => value + 1); }} /> : null}
	</PageContainer>;
}
