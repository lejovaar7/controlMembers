import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { childEnvironment, commandPlan, readConfig, validateBuild, validateConfig } from "./environments.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const devId = "11111111-1111-4111-8111-111111111111";
const productionId = "22222222-2222-4222-8222-222222222222";

function configured() {
	const config = readConfig();
	config.env.dev.d1_databases[0].database_id = devId;
	config.env.production.d1_databases[0].database_id = productionId;
	config.env.dev.routes[0].pattern = "dev.fixture-saas.com";
	config.env.production.routes[0].pattern = "app.fixture-saas.com";
	return config;
}

test("the template has isolated local, dev and production resources", () => {
	assert.doesNotThrow(() => validateConfig(readConfig()));
});

test("local commands override inherited production selection without deleting credentials", () => {
	const env = childEnvironment("local", { CLOUDFLARE_ENV: "production", CLOUDFLARE_API_TOKEN: "fixture" });
	assert.equal(env.CLOUDFLARE_ENV, "");
	assert.equal(env.CLOUDFLARE_API_TOKEN, "fixture");
	assert.equal(env.CLOUDFLARE_VITE_FORCE_LOCAL, "true");
	assert.equal(childEnvironment("dev", env).CLOUDFLARE_ENV, "dev");
	assert.equal(childEnvironment("production", env).CLOUDFLARE_ENV, "production");
});

test("local development and preview use the auth URL's fixed loopback port", () => {
	const config = readConfig();
	assert.deepEqual(commandPlan(config, "local", "dev"), [["vite", "--host", "localhost", "--port", "5173", "--strictPort"]]);
	assert.deepEqual(commandPlan(config, "local", "preview").at(-1), ["vite", "preview", "--host", "localhost", "--port", "5173", "--strictPort"]);
});

test("all three targets can build and dry-run with placeholders, without remote writes", () => {
	for (const target of ["local", "dev", "production"]) {
		assert.deepEqual(commandPlan(readConfig(), target, "build"), [["tsc", "-b"], ["vite", "build"]]);
		assert.deepEqual(commandPlan(readConfig(), target, "dry-run").at(-1), ["wrangler", "deploy", "--dry-run"]);
	}
});

test("local migration selects the source config, DB binding and --local explicitly", () => {
	const [command] = commandPlan(readConfig(), "local", "migrate");
	assert.deepEqual(command, ["wrangler", "d1", "migrations", "apply", "DB", "--config", "wrangler.json", "--env", "", "--local"]);
});

test("remote migrations select the exact environment rather than the last built artifact", () => {
	for (const target of ["dev", "production"]) {
		const [command] = commandPlan(configured(), target, "migrate");
		assert.deepEqual(command, ["wrangler", "d1", "migrations", "apply", "DB", "--config", "wrangler.json", "--env", target, "--remote"]);
	}
});

test("deploy always rebuilds its target before invoking Wrangler and does not migrate", () => {
	for (const target of ["dev", "production"]) {
		assert.deepEqual(commandPlan(configured(), target, "deploy"), [["tsc", "-b"], ["vite", "build"], ["wrangler", "deploy"]]);
	}
});

test("unconfigured database IDs stop remote commands before invoking any subprocess", () => {
	for (const target of ["dev", "production"]) {
		const config = configured();
		config.env[target].d1_databases[0].database_id = "REPLACE_WITH_DATABASE_ID";
		for (const action of ["deploy", "migrate"]) {
			assert.throws(() => commandPlan(config, target, action), /replace the D1 placeholder/);
		}
	}
});

test("a template custom domain blocks deployment but not database preparation", () => {
	const config = configured();
	config.env.dev.routes[0].pattern = "dev.example.invalid";
	assert.throws(() => commandPlan(config, "dev", "deploy"), /example custom domain/);
	assert.doesNotThrow(() => commandPlan(config, "dev", "migrate"));
});

test("dev deployment does not require a recipient allowlist", () => {
	const config = configured();
	assert.equal(config.env.dev.send_email[0].allowed_destination_addresses, undefined);
	assert.doesNotThrow(() => validateConfig(config));
	assert.deepEqual(commandPlan(config, "dev", "deploy").at(-1), ["wrangler", "deploy"]);
});

test("shared Worker, D1 name, D1 ID and custom domain are rejected", () => {
	for (const mutate of [
		(config) => { config.env.dev.name = config.env.production.name; },
		(config) => { config.env.dev.d1_databases[0].database_name = config.env.production.d1_databases[0].database_name; },
		(config) => { config.env.dev.d1_databases[0].database_id = productionId; },
		(config) => { config.env.dev.routes[0].pattern = config.env.production.routes[0].pattern; },
	]) {
		const config = configured();
		mutate(config);
		assert.throws(() => validateConfig(config), /different|distinct/);
	}
});

test("missing non-inherited bindings and divergent migrations are rejected", () => {
	for (const mutate of [
		(config) => { delete config.env.dev.d1_databases; },
		(config) => { delete config.env.production.send_email; },
		(config) => { config.env.dev.d1_databases[0].migrations_dir = "./other"; },
		(config) => { config.env.dev.secrets.required = []; },
	]) {
		const config = configured();
		mutate(config);
		assert.throws(() => validateConfig(config));
	}
});

test("local bindings cannot accidentally opt into remote resources", () => {
	const config = configured();
	config.d1_databases[0].remote = true;
	assert.throws(() => validateConfig(config), /local D1 simulation/);
	config.d1_databases[0].remote = false;
	config.send_email[0].remote = true;
	assert.throws(() => validateConfig(config), /local email simulation/);
});

test("local publication, remote interactive development and unknown targets are rejected", () => {
	for (const [target, action] of [["local", "deploy"], ["production", "dev"], ["dev", "test"], ["prod", "migrate"], ["dev", "unknown"]]) {
		assert.throws(() => commandPlan(configured(), target, action));
	}
});

test("local routes and alternate public URLs stay disabled", () => {
	const config = configured();
	config.routes = [{ pattern: "local.fixture-saas.com", custom_domain: true }];
	assert.throws(() => validateConfig(config), /Local must not have public routes/);
	config.routes = [];
	config.env.dev.workers_dev = true;
	assert.throws(() => validateConfig(config), /disable workers.dev/);
});

test("ambiguous commands and argument injection fail before running tools", () => {
	for (const args of [[], ["dev", "deploy", "--env", "production"], ["local", "migrate", "--remote"]]) {
		const result = spawnSync(process.execPath, [path.join(root, "scripts/environments.mjs"), ...args], {
			encoding: "utf8",
		});
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Choose an explicit command/);
		assert.equal(result.stdout, "");
	}
});

test("built targets must retain their selected Worker, database, routes and email policy", () => {
	const config = configured();
	for (const target of ["local", "dev", "production"]) {
		const entry = target === "local" ? config : config.env[target];
		const built = { ...structuredClone(entry), targetEnvironment: target === "local" ? "" : target };
		assert.doesNotThrow(() => validateBuild(config, target, built));
		for (const mutate of [
			(copy) => { copy.name = "wrong-worker"; },
			(copy) => { copy.targetEnvironment = "wrong-environment"; },
			(copy) => { copy.d1_databases[0].database_id = "wrong-id"; },
			(copy) => { copy.routes = [{ pattern: "wrong-domain" }]; },
			(copy) => { copy.workers_dev = true; },
			(copy) => { copy.send_email = []; },
		]) {
			const copy = structuredClone(built);
			mutate(copy);
			assert.throws(() => validateBuild(config, target, copy), /refusing to deploy/);
		}
	}
});

test("database UUID case differences cannot bypass separation", () => {
	const config = configured();
	config.env.dev.d1_databases[0].database_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	config.env.production.d1_databases[0].database_id = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
	assert.throws(() => validateConfig(config), /different/);
});
