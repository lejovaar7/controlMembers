import { useEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

type BillingDayInputProps = Omit<ComponentProps<typeof Input>, "type" | "inputMode" | "value" | "onChange" | "min" | "max" | "step" | "maxLength" | "pattern"> & {
	value: string;
	onValueChange: (value: string) => void;
	maxDay?: 28 | 31;
};

/** Anniversary schedules allow short-month clamping; legacy schedules stop at 28. */
export function BillingDayInput({ value, onValueChange, id, maxDay = 28, ...props }: BillingDayInputProps) {
	const t = useT();
	const inputRef = useRef<HTMLInputElement>(null);
	const invalid = value !== "" && (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > maxDay);
	const error = invalid ? t(maxDay === 31 ? "Choose a day from 1 to 31." : "Choose a day from 1 to 28.") : "";
	useEffect(() => { inputRef.current?.setCustomValidity(error); }, [error]);
	return <>
		<Input {...props} ref={inputRef} id={id} type="text" inputMode="numeric" maxLength={2} pattern={maxDay === 31 ? "0?[1-9]|[12][0-9]|3[01]" : "0?[1-9]|1[0-9]|2[0-8]"}
			value={value} aria-invalid={invalid} aria-describedby={invalid && id ? `${id}-error` : props["aria-describedby"]}
			onChange={(event) => { const next = event.target.value; if (/^\d{0,2}$/.test(next)) onValueChange(next); }} />
		{invalid ? <p id={id ? `${id}-error` : undefined} role="alert" className="text-sm text-destructive">{error}</p> : null}
	</>;
}
