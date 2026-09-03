import { useT } from "@/lib/i18n";
import type { Company } from "@/lib/companies";

/** A single-company user does not need a selector. Data is owned by the shell. */
export function OrganizationSwitcher({ companies, activeOrganizationId, switching, onSelect }: {
	companies: Company[];
	activeOrganizationId: string;
	switching: boolean;
	onSelect: (id: string) => void;
}) {
	const t = useT();
	if (companies.length === 1) return <span className="min-w-0 break-words text-sm font-medium">{companies[0]!.name}</span>;
	return <div className="min-w-0 max-w-full">
		<label htmlFor="organization-switcher" className="sr-only">{t("Company")}</label>
		<select id="organization-switcher" className="border-input bg-background focus-visible:ring-ring h-8 min-w-0 max-w-full rounded-md border px-2 text-sm"
			value={activeOrganizationId} disabled={switching} onChange={(event) => {
				if (event.target.value !== activeOrganizationId && companies.some((company) => company.id === event.target.value)) onSelect(event.target.value);
			}}>
			{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
		</select>
	</div>;
}
