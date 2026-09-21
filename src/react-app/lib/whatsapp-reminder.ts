/** Click-to-chat is a draft handoff, never evidence of delivery. */
export function whatsappReminderUrl(phone: string, message: string): string {
	if (!/^\+[1-9]\d{7,14}$/.test(phone) || !message.trim() || message.length > 2000) throw new Error("INVALID_REMINDER");
	return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message.trim())}`;
}
