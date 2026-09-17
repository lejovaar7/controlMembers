#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { childEnvironment, readConfig, targetConfig, validateConfig } from "./environments.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const wranglerPath = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const targets = ["local", "dev", "production"];

export const usage = `Create the first platform administrator without a default password.

Usage:
  npm run bootstrap:admin -- --env local --email admin@example.com --name "Platform Admin"
  npm run bootstrap:admin -- --env dev --email admin@example.com --name "Platform Admin"
  npm run bootstrap:admin -- --env production --email admin@example.com --name "Platform Admin" --confirm-production

The application must be running at the configured URL so it can send the one-time setup link.`;

function requireValue(condition, message) {
	if (!condition) throw new Error(message);
}

export function parseArguments(argv) {
	const values = {};
	let confirmProduction = false;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--confirm-production") {
			requireValue(!confirmProduction, "--confirm-production may only be provided once.");
			confirmProduction = true;
			continue;
		}
		requireValue(["--env", "--email", "--name"].includes(argument), `Unknown argument: ${argument}`);
		requireValue(values[argument] === undefined, `${argument} may only be provided once.`);
		const value = argv[index + 1];
		requireValue(value && !value.startsWith("--"), `${argument} requires a value.`);
		values[argument] = value;
		index += 1;
	}

	const target = values["--env"];
	const email = values["--email"]?.trim().toLowerCase();
	const name = values["--name"]?.trim().replace(/\s+/g, " ");
	requireValue(targets.includes(target), "--env must be local, dev, or production.");
	requireValue(email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Provide a valid --email value.");
	requireValue(name && name.length <= 100, "Provide a --name value of 1 to 100 characters.");
	requireValue(target !== "production" || confirmProduction, "Production requires --confirm-production.");
	requireValue(target === "production" || !confirmProduction, "--confirm-production is only valid with --env production.");
	return { target, email, name, confirmProduction };
}

function isExampleDomain(domain) {
	return /\.(invalid|test|example|localhost)$/i.test(domain) || /(^|\.)example\.(com|net|org)$/i.test(domain);
}

export function bootstrapPlan(config, options) {
	validateConfig(config);
	const entry = targetConfig(config, options.target);
	const environmentArgs = ["--config", "wrangler.json", "--env", options.target === "local" ? "" : options.target];
	if (options.target === "local") {
		return { baseUrl: "http://localhost:5173", databaseArgs: [...environmentArgs, "--local"] };
	}

	const databaseId = entry.d1_databases[0].database_id;
	requireValue(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(databaseId),
		`${options.target}: replace the D1 placeholder with the real database UUID first.`);
	const domain = entry.routes[0].pattern;
	requireValue(!isExampleDomain(domain), `${options.target}: replace the example domain before bootstrapping an administrator.`);
	return { baseUrl: `https://${domain}`, databaseArgs: [...environmentArgs, "--remote"] };
}

export function sqlLiteral(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

export function stateQuery(email) {
	return `SELECT u.id, u.email, u.role,
CASE WHEN EXISTS (
  SELECT 1 FROM account AS a WHERE a.user_id = u.id AND a.password IS NOT NULL
) THEN 1 ELSE 0 END AS has_password
FROM user AS u
WHERE lower(u.email) = lower(${sqlLiteral(email)})
   OR (',' || replace(lower(coalesce(u.role, '')), ' ', '') || ',') LIKE '%,admin,%'
ORDER BY u.created_at;`;
}

export function insertStatement({ id, email, name, timestamp }) {
	return `INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at)
SELECT ${sqlLiteral(id)}, ${sqlLiteral(name)}, ${sqlLiteral(email)}, 0, 'admin', ${timestamp}, ${timestamp}
WHERE NOT EXISTS (
  SELECT 1 FROM user
  WHERE lower(email) = lower(${sqlLiteral(email)})
     OR (',' || replace(lower(coalesce(role, '')), ' ', '') || ',') LIKE '%,admin,%'
);`;
}

function hasAdminRole(role) {
	return String(role ?? "").split(",").map((value) => value.trim().toLowerCase()).includes("admin");
}

export function decideBootstrap(rows, email) {
	const requested = rows.find((row) => String(row.email).toLowerCase() === email);
	const requestedAdmin = requested && hasAdminRole(requested.role) ? requested : undefined;
	if (requestedAdmin) return { action: Number(requestedAdmin.has_password) === 1 ? "ready" : "send", user: requestedAdmin };
	if (rows.some((row) => hasAdminRole(row.role))) {
		throw new Error("A different platform administrator already exists. This first-admin bootstrap cannot add another identity.");
	}
	if (requested) throw new Error("That email already belongs to a non-platform user and will not be elevated by bootstrap.");
	return { action: "create" };
}

function executeSql(databaseArgs, sql, target) {
	requireValue(existsSync(wranglerPath), "Wrangler is not installed. Run npm run setup:local first.");
	const result = spawnSync(process.execPath, [wranglerPath, "d1", "execute", "DB", ...databaseArgs, "--command", sql, "--json"], {
		cwd: root,
		env: childEnvironment(target),
		encoding: "utf8",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		const detail = result.stderr.trim() || result.stdout.trim();
		throw new Error(`D1 command failed. Confirm the target and apply its migrations first.${detail ? `\n${detail}` : ""}`);
	}
	const payload = JSON.parse(result.stdout);
	requireValue(Array.isArray(payload) && payload.every((entry) => entry.success), "D1 returned an unsuccessful result.");
	return payload.flatMap((entry) => entry.results ?? []);
}

export async function requestSetupLink(baseUrl, email, fetchImplementation = fetch) {
	let response;
	try {
		const setupUrl = new URL("/api/auth/sign-in/magic-link", baseUrl);
		response = await fetchImplementation(setupUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: setupUrl.origin,
			},
			body: JSON.stringify({ email, callbackURL: "/setup-account" }),
		});
	} catch (error) {
		throw new Error(`Could not reach ${baseUrl}. Start or deploy the application, then rerun the same command.`, { cause: error });
	}
	if (!response.ok) {
		const detail = (await response.text()).slice(0, 300);
		throw new Error(`The setup-link request failed with HTTP ${response.status}.${detail ? ` ${detail}` : ""}`);
	}
}

export async function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(usage);
		return;
	}
	const options = parseArguments(argv);
	const plan = bootstrapPlan(readConfig(), options);
	let rows = executeSql(plan.databaseArgs, stateQuery(options.email), options.target);
	let decision = decideBootstrap(rows, options.email);

	if (decision.action === "ready") {
		console.log(`Platform administrator ${options.email} is already configured in ${options.target}.`);
		return;
	}
	if (decision.action === "create") {
		executeSql(plan.databaseArgs, insertStatement({ id: randomUUID(), email: options.email, name: options.name, timestamp: Date.now() }), options.target);
		rows = executeSql(plan.databaseArgs, stateQuery(options.email), options.target);
		decision = decideBootstrap(rows, options.email);
		requireValue(decision.action === "send", "The administrator was not created; another bootstrap may have won the race.");
		console.log(`Created the first platform administrator in ${options.target}.`);
	} else {
		console.log(`Retrying setup for existing platform administrator ${options.email}.`);
	}

	await requestSetupLink(plan.baseUrl, options.email);
	console.log(`Requested a one-time account setup link from ${plan.baseUrl}.`);
	if (options.target === "local") console.log("Open the simulated email under .wrangler/tmp/email/.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
