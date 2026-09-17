import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function sourceFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
	});
}

test("form buttons explicitly declare submission or a non-submit action", () => {
	const missing = [];
	for (const file of sourceFiles(fileURLToPath(new URL("../src/react-app", import.meta.url)))) {
		const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		function visit(node, inForm = false) {
			if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "form") inForm = true;
			if (inForm && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ["Button", "LoadingButton", "button"].includes(node.tagName.getText(source))) {
				const type = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "type");
				if (!type) missing.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
			}
			ts.forEachChild(node, (child) => visit(child, inForm));
		}
		visit(source);
	}
	assert.deepEqual(missing, [], "Base UI defaults to type=button; form save actions must explicitly use type=submit.");
});

test("product interactions use shared dialogs instead of native browser prompts", () => {
	for (const file of sourceFiles(fileURLToPath(new URL("../src/react-app", import.meta.url)))) {
		assert.doesNotMatch(readFileSync(file, "utf8"), /\b(?:window|globalThis)\s*\.\s*(?:alert|confirm|prompt)\s*\(/, file);
	}
});
