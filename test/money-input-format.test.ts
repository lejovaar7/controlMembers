import { expect, it } from "vitest";
import { numericFormatter } from "react-number-format";
import { moneyInputError, moneyInputFormat } from "../src/react-app/lib/money-input-format";

it("groups Spanish monetary input, including four digits and cents", () => {
	expect(numericFormatter("80000", moneyInputFormat("es"))).toBe("80.000");
	expect(numericFormatter("1000", moneyInputFormat("es"))).toBe("1.000");
	expect(numericFormatter("80000.50", moneyInputFormat("es"))).toBe("80.000,50");
	expect(numericFormatter("-12500.25", { ...moneyInputFormat("es"), allowNegative: true })).toBe("-12.500,25");
	expect(moneyInputFormat("es").allowedDecimalSeparators).toEqual([","]);
});

it("keeps English grouping and decimal input consistent with its locale", () => {
	expect(numericFormatter("80000.50", moneyInputFormat("en"))).toBe("80,000.50");
});

it("preserves min/max validation after switching from number to text inputs", () => {
	expect(moneyInputError("0", 0.01)).toBe("min");
	expect(moneyInputError("80000", 0.01, 50000)).toBe("max");
	expect(moneyInputError("-1000", -1000)).toBeNull();
	expect(moneyInputError("-1000.01", -1000)).toBe("min");
	expect(moneyInputError("0", 0)).toBeNull();
});

it("rejects invalid/unsafe amounts and leaves empty values to required validation", () => {
	for (const value of ["-", "NaN", "Infinity", "80.000,50", "1.234", "9007199254740991"]) expect(moneyInputError(value)).toBe("invalid");
	expect(moneyInputError("")).toBeNull();
	expect(moneyInputError("80000.50")).toBeNull();
});
