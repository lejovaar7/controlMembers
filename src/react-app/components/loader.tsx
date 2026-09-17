import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { cn } from "@/lib/utils";

/** The only loading animation used by the application, including before i18n is ready. */
export function Loader({ label, size = "section", className }: {
	label: string;
	size?: "inline" | "section" | "page";
	className?: string;
}) {
	const diameter = size === "inline" ? 20 : size === "page" ? 48 : 36;
	return <span role="status" className={cn("app-loader flex items-center justify-center text-primary",
		size === "inline" ? "inline-flex shrink-0 align-middle" : size === "page" ? "min-h-svh w-full p-6" : "min-h-48 w-full p-6", className)}>
		<span aria-hidden="true"><Ring2 size={diameter} stroke={size === "inline" ? 2 : 3} strokeLength={0.25} speed={0.9} bgOpacity={0.16} color="currentColor" /></span>
		<span className="sr-only">{label}</span>
	</span>;
}
