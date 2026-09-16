import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapPlan, decideBootstrap, insertStatement, parseArguments, requestSetupLink, sqlLiteral, stateQuery } from "./bootstrap-admin.mjs";
import { readConfig } from "./environments.mjs";

function configured() {
	const config = readConfig();
	config.env.dev.d1_databases[0].database_id = "11111111-1111-4111-8111-111111111111";
	config.env.production.d1_databases[0].database_id = "22222222-2222-4222-8222-222222222222";
	config.env.dev.routes[0].pattern = "dev.fixture-saas.com";
	config.env.production.routes[0].pattern = "app.fixture-saas.com";
	config.env.dev.send_email[0].allowed_destination_addresses = ["admin@fixture-saas.com"];
	return config;
}

test("parses an explicit local bootstrap without accepting unsafe omissions", () => {
	assert.deepEqual(parseArguments(["--env", "local", "--email", "ADMIN@example.com", "--name", " Platform   Admin "]), {
		target: "local", email: "admin@example.com", name: "Platform Admin", confirmProduction: false,
	});
	for (const args of [[], ["--env", "prod", "--email", "a@b.com", "--name", "Admin"], ["--env", "local", "--email", "bad", "--name", "Admin"], ["--env", "local", "--email", "a@b.com", "--name", ""]]) {
		assert.throws(() => parseArguments(args));
	}
});

test("production requires its deliberate confirmation flag", () => {
	assert.throws(() => parseArguments(["--env", "production", "--email", "a@b.com", "--name", "Admin"]), /confirm-production/);
	assert.equal(parseArguments(["--env", "production", "--email", "a@b.com", "--name", "Admin", "--confirm-production"]).target, "production");
	assert.throws(() => parseArguments(["--env", "local", "--email", "a@b.com", "--name", "Admin", "--confirm-production"]));
});

test("plans isolated local and remote D1 operations", () => {
	assert.deepEqual(bootstrapPlan(readConfig(), { target: "local", email: "admin@example.com" }), {
		baseUrl: "http://localhost:5173", databaseArgs: ["--config", "wrangler.json", "--env", "", "--local"],
	});
	assert.deepEqual(bootstrapPlan(configured(), { target: "dev", email: "admin@fixture-saas.com" }), {
		baseUrl: "https://dev.fixture-saas.com", databaseArgs: ["--config", "wrangler.json", "--env", "dev", "--remote"],
	});
	assert.throws(() => bootstrapPlan(readConfig(), { target: "dev", email: "qa@example.invalid" }), /D1 placeholder/);
	assert.throws(() => bootstrapPlan(configured(), { target: "dev", email: "other@fixture-saas.com" }), /allowed_destination_addresses/);
});

test("SQL construction escapes user values and keeps bootstrap conditional", () => {
	assert.equal(sqlLiteral("O'Brien"), "'O''Brien'");
	assert.match(stateQuery("admin@example.com"), /account AS a/);
	const statement = insertStatement({ id: "id-1", email: "admin@example.com", name: "O'Brien", timestamp: 123 });
	assert.match(statement, /O''Brien/);
	assert.match(statement, /NOT EXISTS/);
});

test("bootstrap creates only the first admin and safely retries the same identity", () => {
	assert.deepEqual(decideBootstrap([], "admin@example.com"), { action: "create" });
	assert.equal(decideBootstrap([{ email: "admin@example.com", role: "admin", has_password: 0 }], "admin@example.com").action, "send");
	assert.equal(decideBootstrap([{ email: "admin@example.com", role: "admin", has_password: 1 }], "admin@example.com").action, "ready");
	assert.throws(() => decideBootstrap([{ email: "other@example.com", role: "admin", has_password: 1 }], "admin@example.com"), /different platform administrator/);
	assert.throws(() => decideBootstrap([{ email: "admin@example.com", role: "user", has_password: 1 }], "admin@example.com"), /will not be elevated/);
});

test("setup links use the supported endpoint without sending a password", async () => {
	let captured;
	await requestSetupLink("http://localhost:5173", "admin@example.com", async (url, init) => {
		captured = { url: String(url), init };
		return new Response(null, { status: 200 });
	});
	assert.equal(captured.url, "http://localhost:5173/api/auth/sign-in/magic-link");
	assert.equal(captured.init.headers.Origin, "http://localhost:5173");
	assert.deepEqual(JSON.parse(captured.init.body), { email: "admin@example.com", callbackURL: "/setup-account" });
	assert.equal("password" in JSON.parse(captured.init.body), false);
	await assert.rejects(() => requestSetupLink("http://localhost:5173", "admin@example.com", async () => new Response("no", { status: 500 })), /HTTP 500/);
});
