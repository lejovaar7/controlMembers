import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";

export function MemberPhoneFields({ prefix, phone, onPhoneChange, sameAsPhone, onSameAsPhoneChange, whatsapp, onWhatsappChange }: {
	prefix: string; phone: string; onPhoneChange: (value: string) => void;
	sameAsPhone: boolean; onSameAsPhoneChange: (value: boolean) => void;
	whatsapp: string; onWhatsappChange: (value: string) => void;
}) {
	const t = useT();
	return <div className="grid gap-3 sm:col-span-2">
		<div className="grid gap-2"><Label htmlFor={`${prefix}-phone`}>{t("Phone with country code (optional)")}</Label><Input id={`${prefix}-phone`} type="tel" autoComplete="tel" value={phone} maxLength={20} placeholder="+57 300 000 0000" onChange={(event) => onPhoneChange(event.target.value)} /></div>
		<label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" className="size-4 shrink-0 accent-primary" checked={sameAsPhone} onChange={(event) => onSameAsPhoneChange(event.target.checked)} /><span>{t("Use this phone number for WhatsApp")}</span></label>
		{!sameAsPhone ? <div className="grid gap-2"><Label htmlFor={`${prefix}-whatsapp`}>{t("WhatsApp number (optional)")}</Label><Input id={`${prefix}-whatsapp`} type="tel" value={whatsapp} maxLength={20} placeholder="+57 300 000 0000" onChange={(event) => onWhatsappChange(event.target.value)} /><p className="text-xs text-muted-foreground">{t("Include the country code. Leave empty if the member does not use WhatsApp.")}</p></div> : null}
	</div>;
}
