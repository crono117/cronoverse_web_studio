CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`business` text DEFAULT '' NOT NULL,
	`service` text NOT NULL,
	`message` text NOT NULL,
	`language` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inquiries_email_created` ON `inquiries` (`email`,`created_at`);