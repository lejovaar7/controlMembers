import { useState } from "react";
import { ActionDialog, type ActionDialogOptions } from "@/components/action-dialog";

/** One presentation for confirmations and forms; mutations stay in their feature. */
export function useActionDialog() {
	const [state, setState] = useState<{ options: ActionDialogOptions; returnFocus: HTMLElement | null; key: number; open: boolean } | null>(null);
	function openDialog(options: ActionDialogOptions) {
		const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		setState((current) => ({ options, returnFocus, key: (current?.key ?? 0) + 1, open: true }));
	}
	return {
		openDialog,
		dialog: state ? <ActionDialog key={state.key} options={state.options} open={state.open} returnFocus={state.returnFocus} onClose={() => setState((current) => current ? { ...current, open: false } : null)} /> : null,
	};
}
