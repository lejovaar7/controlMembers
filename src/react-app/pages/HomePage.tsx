import { useId, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUpRight, Building2, Check, ChevronDown, CircleCheck, Layers3, LayoutDashboard, ListFilter, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductBrand } from "@/components/product-brand";
import { useT } from "@/lib/i18n";
import "./home.css";

const contactUrl = "https://magdasystems.com/#proyecto";
const previewTabs = [
	{ key: "overview", label: "Overview", icon: LayoutDashboard },
	{ key: "members", label: "Members", icon: UsersRound },
	{ key: "payments", label: "Payments", icon: WalletCards },
] as const;

function ProductPreview() {
	const t = useT();
	const id = useId();
	const [active, setActive] = useState<(typeof previewTabs)[number]["key"]>("overview");
	const rows = [
		{ initials: "AM", name: "Alex Morgan", plan: "Swimming", status: "Paid", className: "paid" },
		{ initials: "SR", name: "Sam Rivera", plan: "Music", status: "Pending", className: "pending" },
		{ initials: "JL", name: "Jamie Lee", plan: "Dance", status: "Paid", className: "paid" },
	] as const;
	return <div className="product-preview">
		<div className="preview-toolbar"><span className="preview-window-dots" aria-hidden="true"><i /><i /><i /></span><span>{t("Your academy")}</span><ShieldCheck size={14} aria-hidden="true" /></div>
		<div className="preview-workspace">
			<div className="preview-heading"><div><span className="preview-eyebrow">{t("Everything, connected.")}</span><h2>{t("Your academy at a glance.")}</h2></div><span className="preview-avatar" aria-hidden="true">{"CM"}</span></div>
			<div className="preview-tabs" role="tablist" aria-label={t("Explore the product")}>
				{previewTabs.map(({ key, label, icon: Icon }, index) => <button key={key} type="button" role="tab" id={`${id}-${key}`} aria-selected={active === key} aria-controls={`${id}-panel`} tabIndex={active === key ? 0 : -1} onClick={() => setActive(key)} onKeyDown={(event) => {
					const next = event.key === "ArrowRight" ? (index + 1) % previewTabs.length : event.key === "ArrowLeft" ? (index + previewTabs.length - 1) % previewTabs.length : event.key === "Home" ? 0 : event.key === "End" ? previewTabs.length - 1 : null;
					if (next === null) return;
					event.preventDefault();
					setActive(previewTabs[next].key);
					document.getElementById(`${id}-${previewTabs[next].key}`)?.focus();
				}}><Icon size={15} aria-hidden="true" />{t(label)}</button>)}
			</div>
			<div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`} tabIndex={0} className="preview-panel">
				{active === "overview" ? <>
					<div className="preview-metrics"><div><span>{t("Active members")}</span><strong>{"128"}</strong><small>{t("One connected community")}</small></div><div><span>{t("Collection progress")}</span><strong>{"84%"}</strong><small><span className="preview-dot" />{t("A clearer monthly picture")}</small></div></div>
					<div className="preview-chart"><div className="preview-chart-title"><strong>{t("Monthly collections")}</strong><span>{t("Illustrative data")}</span></div><div className="preview-bars" aria-hidden="true">{[42, 59, 48, 72, 64, 84].map((value, index) => <div key={index}><span style={{ height: `${value}%` }} /><small>{String(index + 1).padStart(2, "0")}</small></div>)}</div></div>
				</> : <div className="preview-records"><div className="preview-chart-title"><strong>{t(active === "members" ? "Your members, organized." : "Every payment, in its place.")}</strong><ListFilter size={16} aria-hidden="true" /></div>{rows.map((row) => <div className="preview-record" key={row.initials}><span className="preview-person" aria-hidden="true">{row.initials}</span><div><strong>{row.name}</strong><small>{t(active === "members" ? row.plan : "Monthly fee")}</small></div><span className={`preview-status ${row.className}`}>{t(row.status)}</span></div>)}</div>}
			</div>
			<div className="preview-bottom"><CircleCheck size={14} aria-hidden="true" /><span>{t("Members, payments and balances. Together.")}</span></div>
		</div>
		<div className="preview-caption">{t("Interactive preview · fictional data")}</div>
	</div>;
}

export function HomePage() {
	const t = useT();
	const features = [
		{ icon: UsersRound, title: "People first. Details in order.", detail: "Keep member profiles, contacts and enrollments together. Find the right information without searching through spreadsheets.", tag: "Members & enrollments" },
		{ icon: WalletCards, title: "A clear path from charge to payment.", detail: "Generate monthly charges, record payments and see what is still owed. Every movement keeps its context.", tag: "Charges & payments" },
		{ icon: LayoutDashboard, title: "Less guessing. More clarity.", detail: "See your collections and outstanding balances in one place. Use reports to decide what needs attention next.", tag: "Dashboard & reports" },
	] as const;
	const steps = [
		{ title: "Your academy. Your rules.", detail: "Bring your branches and plans together. Decide who has access and what each person on your team can do." },
		{ title: "Every member, accounted for.", detail: "Add or import your members, assign their plans and check their details and balances without jumping between files." },
		{ title: "Stay on top of every payment.", detail: "Generate monthly charges, record each payment and spot outstanding balances. Know how much you have received and what is still owed." },
	] as const;
	const faqs = [
		{ question: "Is ControlMembers right for my academy?", answer: "It is designed for academies and organizations with recurring member fees: sports, music, dance, swimming, languages and more." },
		{ question: "Can I manage more than one branch?", answer: "Yes. Organize your operation by branch and define which locations each team member can access." },
		{ question: "Can I bring my existing member list?", answer: "Yes. Use the CSV import template and review the preview before saving your members." },
		{ question: "Does it collect online payments?", answer: "ControlMembers records payments you have received and applies them to charges. It does not currently process online payments." },
		{ question: "How do I get access?", answer: "Access is set up with your organization. Contact MagdaSystems to discuss your academy; if you already have an account, sign in with your invitation credentials." },
	] as const;
	const academyTypes = ["Sports", "Music", "Dance", "Swimming", "Languages"] as const;
	return <div className="landing">
		<section className="landing-hero" aria-labelledby="landing-title">
			<div className="landing-container hero-grid">
				<div className="hero-copy"><p className="landing-eyebrow"><span className="eyebrow-line" />{t("Less admin. More possibility.")}</p><h1 id="landing-title" tabIndex={-1}>{t("Your academy,")}<br /><span>{t("under control.")}</span></h1><p className="hero-description">{t("Take control of your academy without the hassle. Manage members, monthly fees and payments in one place. Know who is up to date and what is still owed.")}</p><div className="hero-actions"><Button size="lg" nativeButton={false} render={<a href={contactUrl} />} className="landing-primary">{t("Let's talk about your academy")}<ArrowUpRight aria-hidden="true" /></Button><a className="landing-text-link" href="#product">{t("Explore the product")}<ArrowDown size={16} aria-hidden="true" /></a></div><p className="hero-note"><Check size={15} aria-hidden="true" />{t("Built for academies and membership organizations.")}</p></div>
				<div className="hero-visual"><div className="hero-orbit" aria-hidden="true" /><ProductPreview /><div className="hero-floating-note"><span><Check size={17} aria-hidden="true" /></span><div><strong>{t("Less chasing. More teaching.")}</strong><small>{t("A simpler day starts here.")}</small></div></div></div>
			</div>
			<div className="academy-strip landing-container"><span>{t("A place for every passion")}</span><div>{academyTypes.map((name) => <span key={name}>{t(name)}</span>)}</div></div>
		</section>
		<section id="product" className="landing-section landing-container" aria-labelledby="product-title">
			<p className="landing-eyebrow">{t("01 / THE BIG PICTURE")}</p><div className="section-heading"><h2 id="product-title">{t("Everything in its place.")}<br /><span>{t("Room to move forward.")}</span></h2><p>{t("The everyday essentials, connected. So your team can focus on the people who make your academy.")}</p></div>
			<div className="feature-grid">{features.map(({ icon: Icon, title, detail, tag }, index) => <article className="landing-feature" key={title}><div className="feature-top"><Icon size={25} strokeWidth={1.5} aria-hidden="true" /><span>{String(index + 1).padStart(2, "0")}</span></div><h3>{t(title)}</h3><p>{t(detail)}</p><span className="feature-tag">{t(tag)}</span></article>)}</div>
		</section>
		<section id="workflow" className="workflow-section" aria-labelledby="workflow-title"><div className="landing-container landing-section"><p className="landing-eyebrow">{t("02 / A SIMPLER ROUTINE")}</p><div className="section-heading"><h2 id="workflow-title">{t("More control.")}<br /><span>{t("Less running around.")}</span></h2><p>{t("From enrollment to payment, every step made simpler. Keep the information you need at hand and act with confidence.")}</p></div><div className="workflow-steps">{steps.map(({ title, detail }, index) => <article key={title}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><h3>{t(title)}</h3><p>{t(detail)}</p></article>)}</div><div className="workflow-footnote"><Building2 size={18} aria-hidden="true" /><span>{t("One branch or several. One shared way of working.")}</span><Layers3 size={20} aria-hidden="true" /></div></div></section>
		<section id="questions" className="landing-container landing-section faq-section" aria-labelledby="faq-title"><div><p className="landing-eyebrow">{t("03 / GOOD TO KNOW")}</p><h2 id="faq-title">{t("Clear from")}<br /><span>{t("the start.")}</span></h2><p className="faq-intro">{t("A few answers before your next step.")}</p></div><div className="faq-list">{faqs.map(({ question, answer }) => <details key={question}><summary>{t(question)}<ChevronDown size={18} aria-hidden="true" /></summary><p>{t(answer)}</p></details>)}</div></section>
		<section className="landing-container landing-contact" aria-labelledby="contact-title"><div><p className="landing-eyebrow">{t("YOUR NEXT CHAPTER")}</p><h2 id="contact-title">{t("Take control.")}<br /><span>{t("Simplify your day.")}</span></h2><p>{t("Manage your academy with clarity and put your energy into helping it grow.")}</p></div><div className="contact-actions"><Button size="lg" nativeButton={false} render={<a href={contactUrl} />} className="landing-primary">{t("Talk to MagdaSystems")}<ArrowUpRight aria-hidden="true" /></Button></div></section>
		<footer className="landing-container landing-footer"><Link to="/" aria-label={t("Home")}><ProductBrand compact className="w-40" /></Link><span>{t("Clarity for your academy. Space to grow.")}</span><a href="https://magdasystems.com/">{t("A product by MagdaSystems")}<ArrowUpRight size={14} aria-hidden="true" /></a></footer>
	</div>;
}
