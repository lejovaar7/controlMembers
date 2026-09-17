import { useT } from "@/lib/i18n";
import { Loader } from "@/components/loader";
import type { Company } from "@/lib/companies";

/** A single-company user does not need a selector. Data is owned by the shell. */
export function OrganizationSwitcher({ companies, activeOrganizationId, switching, onSelect }: {
	companies: Company[];
	activeOrganizationId: string;
	switching: boolean;
	onSelect: (id: string) => void;
}) {
	const t = useT();
	if (companies.length === 1) return <span className="min-w-0 break-words text-base font-semibold leading-snug tracking-tight sm:text-lg">{companies[0]!.name}</span>;
	return <div className="flex min-w-0 max-w-full items-center gap-2">
		<label htmlFor="organization-switcher" className="sr-only">{t("Company")}</label>
		<select id="organization-switcher" className="focus-visible:ring-ring h-11 w-full min-w-0 max-w-full rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2"
			value={activeOrganizationId} disabled={switching} onChange={(event) => {
				if (event.target.value !== activeOrganizationId && companies.some((company) => company.id === event.target.value)) onSelect(event.target.value);
			}}>
			{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
		</select>
		{switching && <Loader size="inline" label={t("Loading workspace…")} />}
	</div>;
}
