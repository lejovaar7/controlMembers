import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Technical table used only to verify the
 * schema -> migration -> D1 -> query path.
 */
export const systemCheck = sqliteTable("system_check", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	value: text("value").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});
