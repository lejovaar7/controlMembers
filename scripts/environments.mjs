import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = path.join(root, "wrangler.json");
const targets = ["local", "dev", "production"];
const actions = ["dev", "build", "preview", "dry-run", "deploy", "migrate", "types", "test", "test-watch"];
const localActions = ["dev", "preview", "types", "test", "test-watch"];
const usage = "Choose an explicit command: npm run dev, deploy:dev, deploy:production, db:migrate:local, db:migrate:dev or db:migrate:production. Target overrides and extra arguments are not accepted.";

function requireValue(condition, message) {
	if (!condition) throw new Error(message);
}

export function readConfig() {
	return JSON.parse(readFileSync(configPath, "utf8"));
}

export function targetConfig(config, target) {
	return target === "local" ? config : config.env?.[target];
}

// These checks prevent accidental target sharing; Cloudflare authorization is
// still authoritative, and raw Wrangler commands can bypass this npm wrapper.
export function validateConfig(config) {
	const names = new Set();
	const databaseNames = new Set();
	const databaseIds = new Set();
	const domains = new Set();
	for (const target of targets) {
		const entry = targetConfig(config, target);
		requireValue(entry && typeof entry.name === "string", `Missing ${target} Worker configuration.`);
		requireValue(!names.has(entry.name), "Worker names must be different in every environment.");
		names.add(entry.name);
		requireValue(entry.workers_dev === false && entry.preview_urls === false,
			`${target}: disable workers.dev and preview URLs; use the explicit custom domain.`);
		const databases = entry.d1_databases;
		requireValue(databases?.length === 1 && databases[0].binding === "DB", `${target}: define the DB binding explicitly.`);
		const db = databases[0];
		requireValue(typeof db.database_name === "string" && typeof db.database_id === "string", `${target}: missing D1 name or ID.`);
		requireValue(!databaseNames.has(db.database_name) && !databaseIds.has(db.database_id.toLowerCase()),
			"D1 names and IDs must be different in every environment.");
		databaseNames.add(db.database_name);
		databaseIds.add(db.database_id.toLowerCase());
		requireValue(db.remote === false && db.migrations_dir === "./drizzle",
			`${target}: keep local D1 simulation and the shared Drizzle migration directory.`);
		requireValue(entry.send_email?.length === 1 && entry.send_email[0].name === "EMAIL" && entry.send_email[0].remote === false,
			`${target}: define EMAIL explicitly and keep local email simulation.`);
		for (const secret of ["BETTER_AUTH_SECRET", "APP_URL", "EMAIL_FROM"]) {
			requireValue(entry.secrets?.required?.includes(secret), `${target}: missing required secret ${secret}.`);
		}
		if (target === "local") {
			requireValue(entry.routes?.length === 0, "Local must not have public routes.");
		} else {
			requireValue(entry.routes?.length === 1 && entry.routes[0].custom_domain === true,
				`${target}: configure one explicit custom domain.`);
			const domain = entry.routes[0].pattern;
			requireValue(typeof domain === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && !domains.has(domain.toLowerCase()),
				"Dev and production must have distinct hostnames, without a protocol, path or wildcard.");
			domains.add(domain.toLowerCase());
		}
	}
	const recipients = config.env.dev.send_email[0].allowed_destination_addresses;
	requireValue(Array.isArray(recipients) && recipients.length > 0 && recipients.every((email) => typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
		"Dev email requires an explicit, nonempty test-recipient allowlist.");
}

export function commandPlan(config, target, action) {
	requireValue(targets.includes(target) && actions.includes(action), usage);
	requireValue(target === "local" || !localActions.includes(action), "Interactive development and tests are local-only.");
	requireValue(target !== "local" || action !== "deploy", "Local cannot be deployed. " + usage);
	validateConfig(config);
	const entry = targetConfig(config, target);
	if (target !== "local" && ["deploy", "migrate"].includes(action)) {
		requireValue(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(entry.d1_databases[0].database_id),
			`${target}: replace the D1 placeholder with that environment's real database UUID before remote operations.`);
		if (action === "deploy") {
			requireValue(!/\.(invalid|test|example|localhost)$/i.test(entry.routes[0].pattern) && !/(^|\.)example\.(com|net|org)$/i.test(entry.routes[0].pattern),
				`${target}: replace the example custom domain before deploying.`);
			if (target === "dev") {
				requireValue(!entry.send_email[0].allowed_destination_addresses.some((email) => /\.(invalid|test|example|localhost)$/i.test(email) || /@(?:[^@]+\.)?example\.(com|net|org)$/i.test(email)),
					"Dev: replace the example recipients with controlled test mailboxes before deploying.");
			}
		}
	}
	const build = [["tsc", "-b"], ["vite", "build"]];
	// Children always run from root; a relative source path keeps generated
	// binding-type headers reproducible across machines.
	const envArgs = ["--config", "wrangler.json", "--env", target === "local" ? "" : target];
	switch (action) {
		case "dev": return [["vite", "--host", "localhost", "--port", "5173", "--strictPort"]];
		case "build": return build;
		case "preview": return [...build, ["vite", "preview", "--host", "localhost", "--port", "5173", "--strictPort"]];
		case "dry-run": return [...build, ["wrangler", "deploy", "--dry-run"]];
		case "deploy": return [...build, ["wrangler", "deploy"]];
		case "migrate": return [["wrangler", "d1", "migrations", "apply", "DB", ...envArgs, target === "local" ? "--local" : "--remote"]];
		case "types": return [["wrangler", "types", ...envArgs]];
		case "test": return [["vitest", "run"]];
		case "test-watch": return [["vitest"]];
		default: throw new Error(usage);
	}
}

export function childEnvironment(target, inherited = process.env) {
	return {
		...inherited,
		// Explicit empty selection preserves the original local D1 identity and
		// overrides inherited production settings and Vite's .env selection.
		CLOUDFLARE_ENV: target === "local" ? "" : target,
		CLOUDFLARE_VITE_FORCE_LOCAL: "true",
		CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
	};
}

export function validateBuild(config, target, built) {
	const expected = targetConfig(config, target);
	const database = built.d1_databases?.find((db) => db.binding === "DB");
	requireValue(built.name === expected.name && built.targetEnvironment === (target === "local" ? "" : target),
		"The built Worker/environment does not match the selected target; refusing to deploy.");
	requireValue(database?.database_name === expected.d1_databases[0].database_name && database?.database_id === expected.d1_databases[0].database_id,
		"The built DB binding does not match the selected target; refusing to deploy.");
	requireValue(JSON.stringify(built.routes) === JSON.stringify(expected.routes) && built.workers_dev === false && built.preview_urls === false,
		"The built public routes do not match the selected target; refusing to deploy.");
	requireValue(JSON.stringify(built.send_email) === JSON.stringify(expected.send_email),
		"The built email policy does not match the selected target; refusing to deploy.");
}

export function run(target, action) {
	const config = readConfig();
	const commands = commandPlan(config, target, action);
	const bins = {
		tsc: "typescript/bin/tsc",
		vite: "vite/bin/vite.js",
		wrangler: "wrangler/bin/wrangler.js",
		vitest: "vitest/vitest.mjs",
	};
	console.log(`Environment: ${target}; operation: ${action}; Worker: ${targetConfig(config, target).name}`);
	for (const [tool, ...args] of commands) {
		const result = spawnSync(process.execPath, [path.join(root, "node_modules", bins[tool]), ...args], {
			cwd: root,
			env: childEnvironment(target),
			stdio: "inherit",
		});
		if (result.error) throw result.error;
		if (result.status !== 0) return result.status ?? 1;
		if (tool === "vite" && args[0] === "build") {
			const redirectFile = path.join(root, ".wrangler/deploy/config.json");
			const redirect = JSON.parse(readFileSync(redirectFile, "utf8"));
			const built = JSON.parse(readFileSync(path.resolve(path.dirname(redirectFile), redirect.configPath), "utf8"));
			validateBuild(config, target, built);
			console.log(`Verified build target: ${target}; database: ${built.d1_databases[0].database_name}`);
		}
	}
	return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		requireValue(process.argv.length === 4, usage);
		process.exitCode = run(process.argv[2], process.argv[3]);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
