import { applyD1Migrations, env } from "cloudflare:test";
import { vi } from "vitest";

// Runs the real Drizzle-generated migrations against each isolated test D1.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Tests never deliver email, simulated or real. The EmailService contract is
// asserted against this double instead.
env.EMAIL.send = vi.fn(async () => ({ messageId: "test-message-id" }));
