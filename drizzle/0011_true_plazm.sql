CREATE TABLE `allocation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`charge_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`charge_id`) REFERENCES `charge`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "allocation_amount_check" CHECK("allocation"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allocation_payment_charge_uidx` ON `allocation` (`payment_id`,`charge_id`);--> statement-breakpoint
CREATE INDEX `allocation_org_charge_idx` ON `allocation` (`organization_id`,`charge_id`);--> statement-breakpoint
CREATE TABLE `audit_event` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`branch_id` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_event_org_subject_idx` ON `audit_event` (`organization_id`,`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `audit_event_org_created_idx` ON `audit_event` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `charge` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`member_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`billing_period` text NOT NULL,
	`due_date` text NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`discount_minor` integer DEFAULT 0 NOT NULL,
	`adjustment_minor` integer DEFAULT 0 NOT NULL,
	`total_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`member_name_snapshot` text NOT NULL,
	`plan_name_snapshot` text NOT NULL,
	`branch_name_snapshot` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`void_reason` text,
	`voided_by_user_id` text,
	`voided_at` integer,
	`generation_batch_id` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollment`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`) REFERENCES `customer_member`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`voided_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "charge_status_check" CHECK("charge"."status" in ('open', 'void')),
	CONSTRAINT "charge_total_check" CHECK("charge"."total_minor" >= 0 and "charge"."total_minor" = "charge"."subtotal_minor" - "charge"."discount_minor" + "charge"."adjustment_minor")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `charge_org_enrollment_period_uidx` ON `charge` (`organization_id`,`enrollment_id`,`billing_period`);--> statement-breakpoint
CREATE INDEX `charge_org_period_branch_idx` ON `charge` (`organization_id`,`billing_period`,`branch_id`);--> statement-breakpoint
CREATE INDEX `charge_org_member_due_idx` ON `charge` (`organization_id`,`member_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `contact` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`phone_e164` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `contact_org_name_idx` ON `contact` (`organization_id`,`display_name`);--> statement-breakpoint
CREATE TABLE `customer_member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`primary_branch_id` text NOT NULL,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`document_type` text,
	`document_number` text,
	`normalized_document` text,
	`birth_date` text,
	`email` text,
	`phone_e164` text,
	`notes` text,
	`external_reference` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "customer_member_status_check" CHECK("customer_member"."status" in ('active', 'paused', 'inactive'))
);
--> statement-breakpoint
CREATE INDEX `customer_member_org_branch_status_idx` ON `customer_member` (`organization_id`,`primary_branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `customer_member_org_name_idx` ON `customer_member` (`organization_id`,`normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_member_org_document_uidx` ON `customer_member` (`organization_id`,`normalized_document`) WHERE "customer_member"."normalized_document" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_member_org_external_ref_uidx` ON `customer_member` (`organization_id`,`external_reference`) WHERE "customer_member"."external_reference" is not null;--> statement-breakpoint
CREATE TABLE `enrollment` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`member_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`agreed_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`due_day` integer NOT NULL,
	`discount_minor` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `customer_member`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "enrollment_status_check" CHECK("enrollment"."status" in ('active', 'paused', 'ended')),
	CONSTRAINT "enrollment_amount_check" CHECK("enrollment"."agreed_amount_minor" > 0),
	CONSTRAINT "enrollment_due_day_check" CHECK("enrollment"."due_day" between 1 and 28),
	CONSTRAINT "enrollment_discount_check" CHECK("enrollment"."discount_minor" >= 0 and "enrollment"."discount_minor" <= "enrollment"."agreed_amount_minor")
);
--> statement-breakpoint
CREATE INDEX `enrollment_org_member_status_idx` ON `enrollment` (`organization_id`,`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `enrollment_org_branch_status_idx` ON `enrollment` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `enrollment_active_member_plan_branch_uidx` ON `enrollment` (`organization_id`,`member_id`,`plan_id`,`branch_id`) WHERE "enrollment"."status" != 'ended';--> statement-breakpoint
CREATE TABLE `import_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_fingerprint` text NOT NULL,
	`created_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batch_org_key_uidx` ON `import_batch` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `member_contact` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`member_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`relationship` text DEFAULT 'other' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_billing_contact` integer DEFAULT false NOT NULL,
	`whatsapp_consent` text DEFAULT 'none' NOT NULL,
	`consent_captured_at` integer,
	`consent_source` text,
	`consent_withdrawn_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `customer_member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contact`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "member_contact_consent_check" CHECK("member_contact"."whatsapp_consent" in ('none', 'granted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_contact_member_contact_uidx` ON `member_contact` (`member_id`,`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_contact_primary_uidx` ON `member_contact` (`member_id`) WHERE "member_contact"."is_primary" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `member_contact_billing_uidx` ON `member_contact` (`member_id`) WHERE "member_contact"."is_billing_contact" = 1;--> statement-breakpoint
CREATE INDEX `member_contact_org_contact_idx` ON `member_contact` (`organization_id`,`contact_id`);--> statement-breakpoint
CREATE TABLE `payment` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`member_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`paid_at` integer NOT NULL,
	`method` text NOT NULL,
	`external_reference` text,
	`note` text,
	`receipt_number` text NOT NULL,
	`status` text DEFAULT 'posted' NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_fingerprint` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`reversed_by_user_id` text,
	`reversed_at` integer,
	`reversal_reason` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `customer_member`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reversed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_amount_check" CHECK("payment"."amount_minor" > 0),
	CONSTRAINT "payment_method_check" CHECK("payment"."method" in ('cash', 'bank_transfer', 'card', 'other')),
	CONSTRAINT "payment_status_check" CHECK("payment"."status" in ('posted', 'reversed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_org_receipt_uidx` ON `payment` (`organization_id`,`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_org_idempotency_uidx` ON `payment` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `payment_org_paid_branch_idx` ON `payment` (`organization_id`,`paid_at`,`branch_id`);--> statement-breakpoint
CREATE INDEX `payment_org_member_idx` ON `payment` (`organization_id`,`member_id`);--> statement-breakpoint
ALTER TABLE `member` ADD `can_reverse_payments` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `member` ADD `can_adjust_charges` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `member` ADD `can_view_reports` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `member` ADD `can_export_financial_data` integer DEFAULT false NOT NULL;