import { useEffect, type ReactNode } from "react";

/** Avoid accidental native selection drags without disabling selection or copy. */
export function TextDragGuard({ children }: { children: ReactNode }) {
	useEffect(() => {
		function preventSelectionDrag(event: DragEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			const element = target instanceof HTMLElement ? target : target.parentElement;
			// Preserve editing and explicitly draggable widgets.
			if (!element || element.isContentEditable || element.closest('input, textarea, [draggable="true"]')) return;
			const selection = element.ownerDocument.getSelection();
			if (selection && !selection.isCollapsed && selection.containsNode(target, true)) {
				// Chromium can stop delivering clicks after a native selected-text drag.
				// https://issuetracker.google.com/issues/560371177
				event.preventDefault();
			}
		}
		document.addEventListener("dragstart", preventSelectionDrag, true);
		return () => document.removeEventListener("dragstart", preventSelectionDrag, true);
	}, []);
	return children;
}
