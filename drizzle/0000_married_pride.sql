CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`value` text,
	`photo_key` text,
	`photo_type` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_person_date_kind_slot` ON `checkins` (`person_id`,`date`,`kind`,`slot`);--> statement-breakpoint
CREATE INDEX `checkins_person_date` ON `checkins` (`person_id`,`date`);--> statement-breakpoint
CREATE TABLE `circles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circles_invite_code_unique` ON `circles` (`invite_code`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circle_id` text NOT NULL,
	`person_id` text NOT NULL,
	`joined_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_circle_person` ON `members` (`circle_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `members_person` ON `members` (`person_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`weekday_wake` text DEFAULT '07:00' NOT NULL,
	`weekend_wake` text DEFAULT '09:00' NOT NULL,
	`weekday_bed` text DEFAULT '23:00' NOT NULL,
	`reminder_time` text DEFAULT '20:00' NOT NULL,
	`reminders` integer DEFAULT 0 NOT NULL
);
