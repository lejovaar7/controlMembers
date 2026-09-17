CREATE TABLE `payment_method` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_method_org_name_uidx` ON `payment_method` (`organization_id`,`normalized_name`);--> statement-breakpoint
ALTER TABLE `payment` ADD `payment_method_id` text REFERENCES payment_method(id);--> statement-breakpoint
ALTER TABLE `payment` ADD `method_name` text;