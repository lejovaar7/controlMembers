import { Dialog } from "@base-ui/react/dialog";
import { CenteredDialog } from "@/components/centered-dialog";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "../../shared/i18n";

export interface ActionDialogField {
	name: string;
	label: string;
	type: "number" | "textarea";
	defaultValue?: string;
	min?: number;
	max?: number;
	step?: number;
}

export interface ActionDialogOptions {
	title: string;
	description: string;
	confirmLabel: string;
	destructive?: boolean;
	fields?: ActionDialogField[];
	summary?: ReactNode;
	validate?: (values: Record<string, string>) => MessageKey | null;
	onConfirm: (values: Record<string, string>) => Promise<void>;
}

export function ActionDialog({ options, open, onClose, returnFocus }: {
	options: ActionDialogOptions;
	open: boolean;
	onClose: () => void;
	returnFocus: HTMLElement | null;
}) {
	const t = useT();
	const id = useId();
	const busyRef = useRef(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<MessageKey | null>(null);
	const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((options.fields ?? []).map((field) => [field.name, field.defaultValue ?? ""])));
	const incomplete = options.fields?.some((field) => !values[field.name]?.trim());

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busyRef.current || incomplete) return;
		const trimmed = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.trim()]));
		const validation = options.validate?.(trimmed);
		if (validation) { setError(validation); return; }
		busyRef.current = true;
		setPending(true); setError(null);
		try { await options.onConfirm(trimmed); onClose(); }
		catch { setError("We could not save this change. Your information is still here. Please try again."); }
		finally { busyRef.current = false; setPending(false); }
	}

	return <CenteredDialog title={options.title} description={options.description} open={open} pending={pending} onClose={onClose} returnFocus={returnFocus}>
		<form onSubmit={submit} aria-busy={pending}>
			<div className="space-y-4 px-5 py-5 sm:px-7">
				{options.summary ? <div className="rounded-xl border bg-muted/40 p-4 text-sm">{options.summary}</div> : null}
				{options.fields?.map((field) => <div key={field.name} className="grid gap-2">
					<Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
					{field.type === "textarea" ? <textarea id={`${id}-${field.name}`} name={field.name} required maxLength={500} rows={3} disabled={pending} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 sm:text-sm" />
						: <Input id={`${id}-${field.name}`} name={field.name} type="number" required min={field.min} max={field.max} step={field.step ?? 1} disabled={pending} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}
				</div>)}
				{error ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive">{t(error)}</p> : null}
			</div>
			<div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
				<Dialog.Close render={<Button type="button" variant="outline" />} disabled={pending}>{t("Cancel")}</Dialog.Close>
				<LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || incomplete} variant={options.destructive ? "destructive" : "default"}>{options.confirmLabel}</LoadingButton>
			</div>
		</form>
	</CenteredDialog>;
}
