/** Bounded import drafts are data, never spreadsheet formulas or executable code. */
export const IMPORT_ROW_LIMIT = 50;
export const IMPORT_FILE_LIMIT = 100_000;
export const importFields = ["memberName", "documentType", "documentNumber", "email", "phone", "whatsapp", "status", "externalReference", "contactName", "contactEmail", "contactPhone", "relationship", "billingContact", "plan", "startDate", "firstDueDate"] as const;
export type ImportField = typeof importFields[number];
export type ImportMapping = Partial<Record<ImportField, number>>;
/** The interactive import uses the same personal details as the new-member form. */
export const memberFormImportFields = ["memberName", "documentNumber", "email", "phone", "whatsapp", "plan", "startDate", "firstDueDate"] as const satisfies readonly ImportField[];
export type MemberFormImportField = typeof memberFormImportFields[number];
export function memberFormImportMapping(mapping: ImportMapping): ImportMapping {
	return Object.fromEntries(memberFormImportFields.flatMap((field) => mapping[field] === undefined ? [] : [[field, mapping[field]]]));
}
export type ImportDraft = {
	row: number; memberName: string; documentType: string; documentNumber: string;
	email: string; phone: string; whatsappSameAsPhone: boolean; whatsapp: string;
	status: string; externalReference: string; contactName: string; contactEmail: string;
	contactPhone: string; relationship: string; billingContact: boolean;
	planId: string | null; startDate: string; firstDueDate: string; sourcePlan?: string;
};
export type ImportRequest = { branchId: string; rows: ImportDraft[] };
export type ImportRowResult = { row: number; errors: string[]; planName: string | null; amountMinor: number; currency: string | null; createsCharge: boolean };
export type ImportReview = { rows: ImportRowResult[]; validCount: number; invalidCount: number; reviewToken: string };

export const normalizeImportLabel = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<ImportField, string[]> = {
	memberName: ["member_name", "displayName", "name", "nombre", "nombre completo", "miembro", "alumno"],
	documentType: ["document_type", "tipo documento"], documentNumber: ["document_number", "documento", "numero documento", "cedula", "identificacion"],
	email: ["email", "correo", "correo electronico"], phone: ["phone", "telefono", "celular", "movil"], whatsapp: ["whatsapp", "numero whatsapp", "whatsappE164"],
	status: ["status", "estado"], externalReference: ["external_reference", "referencia", "codigo externo"],
	contactName: ["contact_name", "acudiente", "nombre acudiente"], contactEmail: ["contact_email", "correo acudiente"], contactPhone: ["contact_phone", "telefono acudiente"],
	relationship: ["relationship", "parentesco"], billingContact: ["billing_contact", "contacto cobro"], plan: ["plan", "plan_name", "plan_id", "mensualidad"], startDate: ["start_date", "fecha inicio", "fecha inscripcion"], firstDueDate: ["first_due_date", "primer vencimiento", "proximo cobro"],
};

export function suggestImportMapping(headers: string[]): ImportMapping {
	const mapping: ImportMapping = {};
	for (const field of importFields) {
		const matches = headers.flatMap((header, index) => aliases[field].some((alias) => normalizeImportLabel(alias) === normalizeImportLabel(header)) ? [index] : []);
		if (matches.length === 1) mapping[field] = matches[0];
	}
	return mapping;
}

/** RFC-style quoted cells; delimiter detection only examines unquoted header cells. */
export function parseImportFile(source: string) {
	if (new TextEncoder().encode(source).length > IMPORT_FILE_LIMIT) throw new Error("FILE_TOO_LARGE");
	const input = source.replace(/^\uFEFF/, "");
	if (!input.trim()) throw new Error("EMPTY_FILE");
	const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
	let quoted = false;
	for (let i = 0; i < input.length; i++) {
		if (input[i] === '"') { if (quoted && input[i + 1] === '"') i++; else quoted = !quoted; }
		else if (!quoted && (input[i] === "\n" || input[i] === "\r")) break;
		else if (!quoted && counts.has(input[i]!)) counts.set(input[i]!, counts.get(input[i]!)! + 1);
	}
	const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
	const records: string[][] = [];
	let row: string[] = [], value = "", closed = false;
	quoted = false;
	const cell = () => { row.push(value.trim()); value = ""; closed = false; };
	const record = () => { cell(); if (row.some(Boolean)) records.push(row); row = []; if (records.length > IMPORT_ROW_LIMIT + 1) throw new Error("TOO_MANY_ROWS"); };
	for (let i = 0; i < input.length; i++) {
		const char = input[i]!;
		if (quoted) {
			if (char === '"' && input[i + 1] === '"') { value += '"'; i++; }
			else if (char === '"') { quoted = false; closed = true; }
			else value += char;
		} else if (char === delimiter) cell();
		else if (char === "\n" || char === "\r") { if (char === "\r" && input[i + 1] === "\n") i++; record(); }
		else if (char === '"' && !value && !closed) quoted = true;
		else if (char === '"' || (closed && char.trim())) throw new Error("INVALID_CSV");
		else if (!closed) value += char;
	}
	if (quoted) throw new Error("INVALID_CSV");
	if (value || row.length || closed) record();
	const headers = records.shift();
	if (!headers?.length || headers.length > 50 || headers.some((header) => !header)) throw new Error("INVALID_HEADERS");
	if (!records.length) throw new Error("NO_DATA_ROWS");
	if (records.some((item) => item.length !== headers.length)) throw new Error("INCONSISTENT_COLUMNS");
	return { headers, records, delimiter };
}

/** The user explicitly chooses whether unprefixed numbers are national or international. */
export function importPhone(value: string, countryCode: string) {
	const phone = value.trim().replace(/^'(?=\+)/, "").replace(/[\s().-]/g, "");
	if (!phone || phone.startsWith("+")) return phone;
	if (phone.startsWith("00")) return `+${phone.slice(2)}`;
	if (countryCode === "+57" && /^57\d{10}$/.test(phone)) return `+${phone}`;
	return /^\d+$/.test(phone) ? `${countryCode || "+"}${phone}` : phone;
}

export function importDate(value: string, order: "dmy" | "mdy") {
	if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
	if (!match) return value;
	return `${match[3]}-${(order === "dmy" ? match[2]! : match[1]!).padStart(2, "0")}-${(order === "dmy" ? match[1]! : match[2]!).padStart(2, "0")}`;
}

export function buildImportDrafts(records: string[][], mapping: ImportMapping, options: { countryCode: string; dateOrder: "dmy" | "mdy"; emptyWhatsApp?: "phone" | "none"; defaultPlan: string; startDate: string; firstDueDate: string; plans: Array<{ id: string; name: string }> }): ImportDraft[] {
	return records.map((record, index) => {
		const get = (field: ImportField) => mapping[field] === undefined ? "" : record[mapping[field]!] ?? "";
		const phone = importPhone(get("phone"), options.countryCode), whatsapp = importPhone(get("whatsapp"), options.countryCode);
		const planText = get("plan");
		const matches = options.plans.filter((plan) => plan.id === planText || normalizeImportLabel(plan.name) === normalizeImportLabel(planText));
		const planId = planText ? (matches.length === 1 ? matches[0]!.id : "") : options.defaultPlan;
		const status = ({ activo: "active", pausado: "paused", inactivo: "inactive" } as Record<string, string>)[get("status").toLowerCase()] ?? (get("status").toLowerCase() || "active");
		return { row: index + 2, memberName: get("memberName"), documentType: get("documentType"), documentNumber: get("documentNumber"), email: get("email"), phone,
			whatsappSameAsPhone: mapping.whatsapp === undefined || (!!whatsapp && whatsapp === phone) || (!whatsapp && options.emptyWhatsApp !== "none"), whatsapp: whatsapp === phone ? "" : whatsapp,
			status, externalReference: get("externalReference"), contactName: get("contactName"), contactEmail: get("contactEmail"), contactPhone: importPhone(get("contactPhone"), options.countryCode), relationship: get("relationship"), billingContact: ["true", "si", "yes", "1"].includes(normalizeImportLabel(get("billingContact"))),
			planId: planId === "__none" ? null : planId, sourcePlan: planText, startDate: importDate(get("startDate"), options.dateOrder) || options.startDate,
			firstDueDate: importDate(get("firstDueDate"), options.dateOrder) || options.firstDueDate };
	});
}
