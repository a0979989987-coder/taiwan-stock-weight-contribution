CREATE TABLE `daily_reports` (
	`date` text PRIMARY KEY NOT NULL,
	`previous_date` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `update_attempts` (
	`date` text PRIMARY KEY NOT NULL,
	`attempted_at` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`lease_until` integer NOT NULL
);
