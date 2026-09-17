#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const localVarsPath = join(projectRoot, ".dev.vars");
const placeholder = "REPLACE_WITH_A_RANDOM_LOCAL_SECRET";

function appendVariable(content, name, value) {
	if (new RegExp(`^${name}=`, "m").test(content)) return content;
	const separator = content.length === 0 || content.endsWith("\n") ? "" : "\n";
	return `${content}${separator}${name}=${value}\n`;
}

function prepareLocalVariables() {
	let content = existsSync(localVarsPath) ? readFileSync(localVarsPath, "utf8") : "";
	let changed = !existsSync(localVarsPath);
	const secretMatch = content.match(/^BETTER_AUTH_SECRET=(.*)$/m);

	if (!secretMatch) {
		content = appendVariable(content, "BETTER_AUTH_SECRET", randomBytes(32).toString("base64"));
		changed = true;
	} else if (!secretMatch[1].trim() || secretMatch[1].trim() === placeholder) {
		content = content.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`);
		changed = true;
	}

	const withAppUrl = appendVariable(content, "APP_URL", "http://localhost:5173");
	const withEmail = appendVariable(withAppUrl, "EMAIL_FROM", "no-reply@dev.controlmembers.magdasystems.com");
	changed ||= withEmail !== content;
	content = withEmail;

	if (changed) writeFileSync(localVarsPath, content, { mode: 0o600 });
	try { chmodSync(localVarsPath, 0o600); } catch { /* Windows may not support POSIX modes. */ }
	console.log(changed ? "Prepared .dev.vars with safe local defaults." : "Preserved the existing .dev.vars configuration.");
}

function runNpm(args) {
	const npmCliPath = process.env.npm_execpath;
	if (!npmCliPath) {
		console.error("Could not locate the npm CLI. Run this setup with: npm run setup:local");
		process.exit(1);
	}

	console.log(`\n> npm ${args.join(" ")}`);
	const result = spawnSync(process.execPath, [npmCliPath, ...args], {
		cwd: projectRoot,
		env: process.env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)) {
	console.error("Node.js 20.19 or newer is required. Node.js 22 LTS is recommended.");
	process.exit(1);
}

prepareLocalVariables();
runNpm(["ci"]);
runNpm(["run", "db:migrate:local"]);

console.log("\nLocal setup is ready. Verify EMAIL_FROM in .dev.vars, authenticate with npx wrangler login, then start with npm run dev. Development sends real email.");
