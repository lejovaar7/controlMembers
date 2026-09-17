import { useState, type ComponentProps, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { enUS, es } from "react-day-picker/locale";
import { DayButton, Root, useDayPicker, type DateRange, type DropdownProps } from "react-day-picker";
import { languages, type Locale } from "../../shared/i18n";
import { dateValue, parseDate, parseMonth } from "@/lib/calendar-dates";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/select-field";

const calendarLocales = { en: enUS, es } satisfies Record<Locale, typeof enUS>;
const triggerClass = "h-11 w-full min-w-0 justify-between gap-3 border-input px-3.5 text-left text-base font-normal md:text-sm";
const popupClass = "date-picker-popup w-auto max-w-[calc(100vw-1rem)] gap-0 overflow-y-auto rounded-2xl p-1 min-[350px]:p-2 shadow-xl motion-reduce:animate-none max-h-[var(--available-height)]";

// Keep component identities stable and retain DayPicker's roving keyboard focus.
function CalendarRoot(props: ComponentProps<typeof Root>) {
	return <Root data-slot="calendar" {...props} />;
}

function PickerDayButton({ modifiers, className, ...props }: ComponentProps<typeof DayButton>) {
	return <DayButton {...props} modifiers={modifiers} className={cn(
		buttonVariants({ variant: "ghost", size: "icon" }),
		"relative z-10 size-(--cell-size) border-0 p-0 font-normal",
		modifiers.selected && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
		modifiers.range_middle && "rounded-none bg-muted text-foreground hover:bg-muted hover:text-foreground",
		modifiers.outside && !modifiers.selected && "text-muted-foreground",
		className,
	)} />;
}

function CalendarDropdown({ options = [], value, disabled, "aria-label": label, field }: DropdownProps & { field: "month" | "year" }) {
	const { months, goToMonth } = useDayPicker();
	return <SelectField aria-label={label} value={String(value)} disabled={disabled}
		className="relative h-10 w-auto gap-1 border-transparent bg-transparent px-1.5 text-sm shadow-none"
		options={options.map((option) => ({ ...option, value: String(option.value) }))}
		onValueChange={(next) => {
			const date = new Date(months[0].date);
			date.setDate(1);
			if (field === "month") date.setMonth(Number(next)); else date.setFullYear(Number(next));
			goToMonth(date);
		}} />;
}

function MonthDropdown(props: DropdownProps) { return <CalendarDropdown {...props} field="month" />; }
function YearDropdown(props: DropdownProps) { return <CalendarDropdown {...props} field="year" />; }
const calendarComponents = { Root: CalendarRoot, DayButton: PickerDayButton, MonthsDropdown: MonthDropdown, YearsDropdown: YearDropdown };

function PickerTrigger({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
	return <PopoverTrigger render={<Button id={id} type="button" variant="outline" aria-label={label} className={cn(triggerClass, className)} />}>
		<span className="min-w-0 truncate">{children}</span><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
	</PopoverTrigger>;
}

function LocalCalendar(props: ComponentProps<typeof Calendar>) {
	const { locale } = useI18n();
	return <Calendar locale={calendarLocales[locale]} captionLayout="dropdown" startMonth={new Date(1900, 0)} endMonth={new Date(new Date().getFullYear() + 20, 11)}
		className="p-0 min-[350px]:p-1 [--cell-size:2.5rem]" components={calendarComponents} {...props} />;
}

export function MonthPicker({ id, label, value, onChange, className }: { id: string; label: string; value: string; onChange: (value: string) => void; className?: string }) {
	const { locale, t } = useI18n();
	const selected = parseMonth(value);
	const [open, setOpen] = useState(false);
	const [year, setYear] = useState((selected ?? new Date()).getFullYear());
	const monthName = (date: Date, full = false) => new Intl.DateTimeFormat(languages[locale].intl, { month: full ? "long" : "short", ...(full ? { year: "numeric" } as const : {}) }).format(date);
	function choose(date: Date) { onChange(dateValue(date).slice(0, 7)); setOpen(false); }
	return <Popover open={open} onOpenChange={(next) => { if (next) setYear((selected ?? new Date()).getFullYear()); setOpen(next); }}>
		<PickerTrigger id={id} label={`${label}: ${selected ? monthName(selected, true) : t("Choose a month")}`} className={className}>{selected ? monthName(selected, true) : t("Choose a month")}</PickerTrigger>
		<PopoverContent align="start" sideOffset={8} className={cn(popupClass, "w-72 p-3")}>
			<PopoverTitle className="sr-only">{label}</PopoverTitle>
			<div className="flex items-center justify-between pb-3">
				<Button type="button" variant="ghost" size="icon" disabled={year <= 1} aria-label={t("Previous year")} onClick={() => setYear(year - 1)}><ChevronLeft aria-hidden="true" /></Button>
				<span className="font-semibold tabular-nums" aria-live="polite">{year}</span>
				<Button type="button" variant="ghost" size="icon" disabled={year >= 9999} aria-label={t("Next year")} onClick={() => setYear(year + 1)}><ChevronRight aria-hidden="true" /></Button>
			</div>
			<div className="grid grid-cols-3 gap-2">{Array.from({ length: 12 }, (_, month) => {
				const date = new Date(0); date.setFullYear(year, month, 1);
				const active = selected?.getFullYear() === year && selected.getMonth() === month;
				return <Button key={month} type="button" variant={active ? "default" : "ghost"} className="h-11 capitalize" aria-pressed={active} aria-label={monthName(date, true)} onClick={() => choose(date)}>{monthName(date)}</Button>;
			})}</div>
			<div className="mt-3 border-t pt-2"><Button type="button" variant="ghost" className="h-11 w-full" onClick={() => choose(new Date())}>{t("This month")}</Button></div>
		</PopoverContent>
	</Popover>;
}

export function DatePicker({ id, label, value: controlled, defaultValue = "", name, onChange }: { id: string; label: string; value?: string; defaultValue?: string; name?: string; onChange?: (value: string) => void }) {
	const { locale, t } = useI18n();
	const [localValue, setLocalValue] = useState(defaultValue);
	const value = controlled ?? localValue;
	const selected = parseDate(value);
	const [open, setOpen] = useState(false);
	const text = selected ? new Intl.DateTimeFormat(languages[locale].intl, { dateStyle: "medium" }).format(selected) : t("Choose a date");
	function choose(date?: Date) { const next = date ? dateValue(date) : ""; setLocalValue(next); onChange?.(next); setOpen(false); }
	return <><Popover open={open} onOpenChange={setOpen}>
		<PickerTrigger id={id} label={`${label}: ${text}`}>{text}</PickerTrigger>
		<PopoverContent align="start" sideOffset={8} className={popupClass}>
			<PopoverTitle className="sr-only">{label}</PopoverTitle>
			<LocalCalendar mode="single" selected={selected} defaultMonth={selected} onSelect={choose} />
			<div className="mt-2 flex justify-between border-t pt-2"><Button type="button" variant="ghost" onClick={() => choose()}>{t("Clear date")}</Button><Button type="button" variant="ghost" onClick={() => choose(new Date())}>{t("Today")}</Button></div>
		</PopoverContent>
	</Popover>{name ? <input type="hidden" name={name} value={value} /> : null}</>;
}

export function DateRangePicker({ id, label, from, to, onChange }: { id: string; label: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
	const { locale, t } = useI18n();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<DateRange>({ from: parseDate(from), to: parseDate(to) });
	const display = (date?: Date) => date ? new Intl.DateTimeFormat(languages[locale].intl, { dateStyle: "medium" }).format(date) : "";
	const rangeText = from && to ? `${display(parseDate(from))} – ${display(parseDate(to))}` : from ? t("From {date}", { date: display(parseDate(from)) }) : to ? t("Until {date}", { date: display(parseDate(to)) }) : t("All dates");
	function apply(range: DateRange) { onChange(range.from ? dateValue(range.from) : "", range.to ? dateValue(range.to) : ""); setOpen(false); }
	return <Popover open={open} onOpenChange={(next) => { if (next) setDraft({ from: parseDate(from), to: parseDate(to) }); setOpen(next); }}>
		<PickerTrigger id={id} label={`${label}: ${rangeText}`}>{rangeText}</PickerTrigger>
		<PopoverContent align="start" sideOffset={8} className={popupClass}>
			<PopoverTitle className="px-2 pt-2">{label}</PopoverTitle>
			<p className="max-w-72 px-2 pt-1 text-xs text-muted-foreground">{t("Choose the first and last day.")}</p>
			<div className="mx-2 my-3 grid grid-cols-2 gap-2">{(["from", "to"] as const).map((bound) => <div key={bound} className="relative min-w-0 rounded-lg bg-muted/60 p-2">
				<p className="text-xs text-muted-foreground">{t(bound === "from" ? "From date" : "To date")}</p>
				<p className="pt-1 text-xs font-medium">{display(draft[bound]) || t("No limit")}</p>
				{draft[bound] ? <Button type="button" variant="ghost" size="icon" className="absolute -right-1 -top-2 size-10" aria-label={t(bound === "from" ? "Clear start date" : "Clear end date")} onClick={() => setDraft({ ...draft, [bound]: undefined })}><X aria-hidden="true" className="size-3" /></Button> : null}
			</div>)}</div>
			<LocalCalendar mode="range" selected={draft.from ? draft : undefined} defaultMonth={draft.from ?? draft.to} onSelect={(range) => setDraft(range ?? { from: undefined })} />
			<div className="mt-2 flex justify-between gap-2 border-t pt-2"><Button type="button" variant="ghost" onClick={() => apply({ from: undefined })}>{t("Clear dates")}</Button><Button type="button" onClick={() => apply(draft)}>{t("Apply dates")}</Button></div>
		</PopoverContent>
	</Popover>;
}
