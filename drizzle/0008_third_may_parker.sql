PRAGMA foreign_keys=OFF;--> statement-breakpoint
UPDATE `organization`
SET `locale` = CASE
	WHEN lower(replace(trim(`locale`), '_', '-')) LIKE 'es%' THEN 'es'
	WHEN lower(replace(trim(`locale`), '_', '-')) LIKE 'en%' THEN 'en'
	ELSE 'en'
END;--> statement-breakpoint
CREATE TABLE `__new_organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`timezone` text,
	`currency` text
);
--> statement-breakpoint
INSERT INTO `__new_organization`("id", "name", "slug", "logo", "created_at", "metadata", "locale", "timezone", "currency") SELECT "id", "name", "slug", "logo", "created_at", "metadata", "locale", "timezone", "currency" FROM `organization`;--> statement-breakpoint
DROP TABLE `organization`;--> statement-breakpoint
ALTER TABLE `__new_organization` RENAME TO `organization`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);
