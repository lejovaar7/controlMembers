import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/loader";
import { useT } from "@/lib/i18n";

/** Keep the action's dimensions stable and prevent duplicate submissions. */
export function LoadingButton({ loading, loadingLabel, disabled, children, ...props }: ComponentProps<typeof Button> & {
	loading: boolean;
	loadingLabel?: string;
}) {
	const t = useT();
	return <Button {...props} disabled={disabled || loading} aria-busy={loading}
		aria-label={loading ? loadingLabel ?? t("Loading…") : props["aria-label"]}>
		<span className="relative grid min-w-0 max-w-full place-items-center">
			<span className={loading ? "invisible flex min-w-0 max-w-full items-center justify-center gap-2" : "flex min-w-0 max-w-full items-center justify-center gap-2"} aria-hidden={loading || undefined}>{children}</span>
			{loading && <span className="absolute inset-0 flex items-center justify-center"><Loader size="inline" className="text-current" label={loadingLabel ?? t("Loading…")} /></span>}
		</span>
	</Button>;
}
