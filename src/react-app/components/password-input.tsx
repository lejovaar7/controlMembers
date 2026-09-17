import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
	const t = useT();
	const [visible, setVisible] = useState(false);
	return <div className="relative min-w-0">
		<Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
		<button type="button" aria-label={t(visible ? "Hide password" : "Show password")} aria-controls={props.id}
			onClick={() => setVisible(value => !value)} disabled={props.disabled}
			className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-offset-[-3px]">
			{visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
		</button>
	</div>;
}
