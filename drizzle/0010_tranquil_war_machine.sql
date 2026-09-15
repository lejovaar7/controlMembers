CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`description` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`default_due_day` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "plan_positive_amount" CHECK("plan"."amount_minor" > 0),
	CONSTRAINT "plan_monthly_frequency" CHECK("plan"."frequency" = 'monthly'),
	CONSTRAINT "plan_due_day_range" CHECK("plan"."default_due_day" between 1 and 28)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_active_name_uidx` ON `plan` (`organization_id`,`normalized_name`) WHERE "plan"."is_active" = 1;--> statement-breakpoint
CREATE INDEX `plan_organization_active_idx` ON `plan` (`organization_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `plan_branch` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_branch_plan_branch_uidx` ON `plan_branch` (`plan_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `plan_branch_organization_branch_idx` ON `plan_branch` (`organization_id`,`branch_id`);--> statement-breakpoint
CREATE TABLE `plan_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_tag_plan_tag_uidx` ON `plan_tag` (`plan_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `plan_tag_organization_tag_idx` ON `plan_tag` (`organization_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_organization_name_uidx` ON `tag` (`organization_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `tag_organization_name_idx` ON `tag` (`organization_id`,`name`);--> statement-breakpoint

-- Preserve every existing monthly offering as a unified Plan. Its former
-- Program description becomes the Plan description when one was assigned.
INSERT INTO `plan` (
	`id`, `organization_id`, `name`, `normalized_name`, `description`,
	`amount_minor`, `currency`, `frequency`, `default_due_day`, `is_active`,
	`created_by_user_id`, `created_at`, `updated_at`
)
SELECT
	`billing_plan`.`id`, `billing_plan`.`organization_id`, `billing_plan`.`name`,
	`billing_plan`.`normalized_name`, `program`.`description`,
	`billing_plan`.`amount_minor`, `billing_plan`.`currency`,
	`billing_plan`.`frequency`, `billing_plan`.`default_due_day`,
	`billing_plan`.`is_active`, `billing_plan`.`created_by_user_id`,
	`billing_plan`.`created_at`, `billing_plan`.`updated_at`
FROM `billing_plan`
LEFT JOIN `program` ON `program`.`id` = `billing_plan`.`program_id`;--> statement-breakpoint

-- Former Programs become optional organizational tags. INSERT OR IGNORE also
-- handles legacy inactive Programs that share a normalized name.
INSERT OR IGNORE INTO `tag` (
	`id`, `organization_id`, `name`, `normalized_name`, `created_by_user_id`,
	`created_at`, `updated_at`
)
SELECT
	`program`.`id`, `program`.`organization_id`, `program`.`name`,
	`program`.`normalized_name`, `program`.`created_by_user_id`,
	`program`.`created_at`, `program`.`updated_at`
FROM `program`
ORDER BY `program`.`is_active` DESC, `program`.`created_at` ASC;--> statement-breakpoint

-- A Plan keeps its former Program as a tag, resolving through the normalized
-- name so deduplicated legacy Programs still map to the canonical tag.
INSERT INTO `plan_tag` (`id`, `organization_id`, `plan_id`, `tag_id`, `created_at`)
SELECT
	`billing_plan`.`id` || ':' || `tag`.`id`,
	`billing_plan`.`organization_id`, `billing_plan`.`id`, `tag`.`id`,
	`billing_plan`.`created_at`
FROM `billing_plan`
JOIN `program` ON `program`.`id` = `billing_plan`.`program_id`
JOIN `tag`
	ON `tag`.`organization_id` = `program`.`organization_id`
	AND `tag`.`normalized_name` = `program`.`normalized_name`;--> statement-breakpoint

-- Plans linked to a former Program inherit its Branch availability.
INSERT INTO `plan_branch` (`id`, `organization_id`, `plan_id`, `branch_id`, `created_at`)
SELECT
	`billing_plan`.`id` || ':' || `program_branch`.`branch_id`,
	`billing_plan`.`organization_id`, `billing_plan`.`id`,
	`program_branch`.`branch_id`, `program_branch`.`created_at`
FROM `billing_plan`
JOIN `program_branch` ON `program_branch`.`program_id` = `billing_plan`.`program_id`;--> statement-breakpoint

-- A former Plan without a Program was organization-wide, so it remains
-- available in every existing Branch.
INSERT INTO `plan_branch` (`id`, `organization_id`, `plan_id`, `branch_id`, `created_at`)
SELECT
	`billing_plan`.`id` || ':' || `team`.`id`,
	`billing_plan`.`organization_id`, `billing_plan`.`id`, `team`.`id`,
	`billing_plan`.`created_at`
FROM `billing_plan`
JOIN `team` ON `team`.`organization_id` = `billing_plan`.`organization_id`
WHERE `billing_plan`.`program_id` IS NULL;--> statement-breakpoint

DROP TABLE `billing_plan`;--> statement-breakpoint
DROP TABLE `program_branch`;--> statement-breakpoint
DROP TABLE `program`;
