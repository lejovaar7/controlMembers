import controlMembersLogo from "@/assets/controlmembers-logo.svg";
import { cn } from "@/lib/utils";

export function ProductBrand({
	className,
	compact = false,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<div className={cn("flex min-w-0 items-center", compact ? "h-9" : "h-14", className)}>
			<img
				src={controlMembersLogo}
				alt="ControlMembers"
				className="h-full w-auto max-w-full object-contain object-left"
			/>
		</div>
	);
}
