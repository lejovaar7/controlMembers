CREATE TABLE `billing_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`program_id` text,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`default_due_day` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "billing_plan_positive_amount" CHECK("billing_plan"."amount_minor" > 0),
	CONSTRAINT "billing_plan_monthly_frequency" CHECK("billing_plan"."frequency" = 'monthly'),
	CONSTRAINT "billing_plan_due_day_range" CHECK("billing_plan"."default_due_day" between 1 and 28)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_plan_active_name_uidx` ON `billing_plan` (`organization_id`,`normalized_name`) WHERE "billing_plan"."is_active" = 1;--> statement-breakpoint
CREATE INDEX `billing_plan_organization_active_idx` ON `billing_plan` (`organization_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `program` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_active_name_uidx` ON `program` (`organization_id`,`normalized_name`) WHERE "program"."is_active" = 1;--> statement-breakpoint
CREATE INDEX `program_organization_active_idx` ON `program` (`organization_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `program_branch` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`program_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `program`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_branch_program_branch_uidx` ON `program_branch` (`program_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `program_branch_organization_branch_idx` ON `program_branch` (`organization_id`,`branch_id`);