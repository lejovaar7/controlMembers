import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "neutral" }) {
	return <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", {
		"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200": tone === "success",
		"bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200": tone === "warning",
		"bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200": tone === "danger",
		"bg-muted text-muted-foreground": tone === "neutral",
	})}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{children}</span>;
}
