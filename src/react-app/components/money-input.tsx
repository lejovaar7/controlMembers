import { useEffect, useRef, type ComponentProps } from "react";
import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { moneyInputError, moneyInputFormat } from "@/lib/money-input-format";
import { formatNumber } from "../../shared/i18n";

type MoneyInputProps = Omit<ComponentProps<typeof Input>, "type" | "inputMode" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"> & {
	value: string | number;
	onValueChange: (value: string) => void;
	min?: number;
	max?: number;
};

/** Display localized grouping while keeping API/form values unformatted. */
export function MoneyInput({ value, onValueChange, min = 0, max, name, ...props }: MoneyInputProps) {
	const { locale, t } = useI18n();
	const inputRef = useRef<HTMLInputElement>(null);
	const error = moneyInputError(String(value), min, max);
	const validation = error === "invalid" ? t("Enter a valid amount.")
		: error === "min" ? t("The amount must be at least {amount}.", { amount: formatNumber(locale, min) })
			: error === "max" ? t("The amount must not exceed {amount}.", { amount: formatNumber(locale, max!) }) : "";
	useEffect(() => { inputRef.current?.setCustomValidity(validation); }, [validation]);
	return <>
		<NumericFormat {...props} {...moneyInputFormat(locale)} customInput={Input} getInputRef={inputRef}
			type="text" inputMode={min < 0 ? "text" : "decimal"} value={value} allowNegative={min < 0}
			onValueChange={(next, source) => { if (source.source === "event") onValueChange(next.value); }} />
		{name ? <input type="hidden" name={name} value={value} disabled={props.disabled} /> : null}
	</>;
}
