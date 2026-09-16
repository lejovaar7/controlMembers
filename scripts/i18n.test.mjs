import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function sourceFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? (entry.name === "ui" ? [] : sourceFiles(path)) : path.endsWith(".tsx") ? [path] : [];
	});
}

test("application JSX copy and accessible labels use the translation catalog", () => {
	const untranslated = [];
	for (const file of sourceFiles(fileURLToPath(new URL("../src/react-app", import.meta.url)))) {
		const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		function visit(node) {
			if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) untranslated.push(`${file}: ${node.text.trim()}`);
			if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label"].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) && /[A-Za-z]/.test(node.initializer.text)) {
				untranslated.push(`${file}: ${node.getText(source)}`);
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	assert.deepEqual(untranslated, []);
});

test("shared localization has no browser, Worker or secret dependencies", () => {
	for (const name of readdirSync(new URL("../src/shared/i18n", import.meta.url))) {
		const code = readFileSync(new URL(`../src/shared/i18n/${name}`, import.meta.url), "utf8");
		assert.doesNotMatch(code, /\b(?:window|document|localStorage|BETTER_AUTH_SECRET|EMAIL_FROM)\b/);
		const source = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true);
		for (const statement of source.statements) {
			if (ts.isImportDeclaration(statement)) assert.match(statement.moduleSpecifier.text, /^\.\/[a-z][a-zA-Z0-9-]*$/);
		}
	}
});
