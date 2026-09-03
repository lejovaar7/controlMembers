ALTER TABLE `member` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `member` ADD `all_branches` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `member` ADD `can_appoint_admins` integer DEFAULT false NOT NULL;