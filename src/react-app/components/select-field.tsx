import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import type { AriaAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean; lang?: string };
type SelectFieldProps = AriaAttributes & {
	id?: string;
	name?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	options: SelectOption[];
	disabled?: boolean;
	required?: boolean;
	autoFocus?: boolean;
	className?: string;
	popupClassName?: string;
};

/** Shared select presentation; Base UI owns keyboard, typeahead and form behavior. */
export function SelectField({ id, name, value, defaultValue, onValueChange, options, disabled, required, autoFocus, className, popupClassName, ...aria }: SelectFieldProps) {
	return <Select.Root<string> name={name} value={value} defaultValue={defaultValue ?? (value === undefined ? options[0]?.value : undefined)}
		items={options} disabled={disabled} required={required} onValueChange={(next) => { if (next !== null) onValueChange?.(next); }}>
		<Select.Trigger id={id} autoFocus={autoFocus} data-slot="select-trigger" {...aria}
			className={cn("flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-input bg-card px-3.5 text-left text-base font-normal text-foreground shadow-xs outline-none transition-colors hover:border-ring/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm", className)}>
			<Select.Value className="min-w-0 truncate" />
			<Select.Icon className="shrink-0 text-muted-foreground"><ChevronDown className="size-4" aria-hidden="true" /></Select.Icon>
		</Select.Trigger>
		<Select.Portal>
			<Select.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} className="z-[70] max-w-[calc(100vw-1rem)]">
				<Select.Popup className={cn("w-[var(--anchor-width)] min-w-32 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/10 outline-none", popupClassName)}>
					<Select.List className="max-h-[min(20rem,calc(var(--available-height)_-_0.875rem))] overflow-y-auto overscroll-contain outline-none">
						{options.map((option) => <Select.Item key={option.value} value={option.value} disabled={option.disabled} lang={option.lang}
							className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-none select-none data-selected:bg-muted/60 data-selected:font-medium data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-40">
							<Select.ItemText className="min-w-0 flex-1 break-words">{option.label}</Select.ItemText>
							<Select.ItemIndicator className="shrink-0"><Check className="size-4" aria-hidden="true" /></Select.ItemIndicator>
						</Select.Item>)}
					</Select.List>
				</Select.Popup>
			</Select.Positioner>
		</Select.Portal>
	</Select.Root>;
}
