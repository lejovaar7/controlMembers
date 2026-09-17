import { Coins } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { currencyName } from "../../shared/i18n";

/** Name the currency once, leaving individual amounts compact and readable. */
export function CurrencyLabel({ currency }: { currency: string }) {
	const { locale, t } = useI18n();
	return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Coins aria-hidden="true" className="size-3.5 shrink-0" /><span>{t("Currency")}: {currencyName(locale, currency)}</span></p>;
}
