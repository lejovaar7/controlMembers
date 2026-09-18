import { languages, type Locale } from "../../shared/i18n";

export function moneyInputFormat(locale: Locale) {
	const parts = new Intl.NumberFormat(languages[locale].intl).formatToParts(1234567.89);
	const decimalSeparator = parts.find((part) => part.type === "decimal")!.value;
	return {
		thousandSeparator: parts.find((part) => part.type === "group")!.value,
		decimalSeparator,
		allowedDecimalSeparators: [decimalSeparator],
		decimalScale: 2,
		valueIsNumericString: true,
	};
}

/** Validate the canonical, ungrouped amount; text inputs lack native min/max. */
export function moneyInputError(value: string, min?: number, max?: number): "invalid" | "min" | "max" | null {
	if (!value) return null;
	const number = Number(value);
	if (!/^-?\d+(?:\.\d{0,2})?$/.test(value) || !Number.isSafeInteger(Math.round(number * 100))) return "invalid";
	if (min !== undefined && number < min) return "min";
	if (max !== undefined && number > max) return "max";
	return null;
}
