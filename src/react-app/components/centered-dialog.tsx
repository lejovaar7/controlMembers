import { Dialog } from "@base-ui/react/dialog";
import { CircleAlert, MessageSquareText, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DialogReturnFocus = HTMLElement | { readonly current: HTMLElement | null } | null;

/** Shared modal presentation for action confirmations and full feature forms. */
export function CenteredDialog({ title, description, open, pending = false, destructive = false, onClose, returnFocus, wide = false, children }: {
	title: string;
	description: string;
	open: boolean;
	pending?: boolean;
	destructive?: boolean;
	onClose: () => void;
	returnFocus?: DialogReturnFocus;
	wide?: boolean;
	children: ReactNode;
}) {
	const t = useT();
	const titleRef = useRef<HTMLHeadingElement>(null);
	return <Dialog.Root open={open} disablePointerDismissal onOpenChange={(next, details) => {
		if (!next) { if (pending) details.cancel(); else onClose(); }
	}}>
		<Dialog.Portal>
			<Dialog.Backdrop className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-[3px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
			<Dialog.Popup initialFocus={titleRef} finalFocus={() => {
				const target = returnFocus && "current" in returnFocus ? returnFocus.current : returnFocus;
				return target?.isConnected ? target : true;
			}}
				className={cn("fixed top-1/2 left-1/2 z-[60] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-card text-card-foreground shadow-2xl outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none", wide && "max-w-2xl")}>
				<div className="relative px-5 pt-6 sm:px-7 sm:pt-7">
					<div aria-hidden="true" className={`mb-4 flex size-11 items-center justify-center rounded-2xl ${destructive ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
						{destructive ? <CircleAlert className="size-5" /> : <MessageSquareText className="size-5" />}
					</div>
					<Dialog.Close render={<Button type="button" variant="ghost" size="icon" />} aria-label={t("Close dialog")} disabled={pending} className="absolute top-4 right-4 rounded-full text-muted-foreground"><X className="size-4" /></Dialog.Close>
					<Dialog.Title ref={titleRef} tabIndex={-1} className="pr-6 text-xl leading-snug font-semibold tracking-tight break-words outline-none">{title}</Dialog.Title>
					<Dialog.Description className="mt-2 text-sm leading-6 break-words text-muted-foreground">{description}</Dialog.Description>
				</div>
				{children}
			</Dialog.Popup>
		</Dialog.Portal>
	</Dialog.Root>;
}
