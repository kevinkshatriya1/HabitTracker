CREATE TABLE `feed_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`checkin_id` text NOT NULL,
	`person_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feed_comments_checkin` ON `feed_comments` (`checkin_id`);--> statement-breakpoint
CREATE TABLE `feed_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checkin_id` text NOT NULL,
	`person_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_likes_checkin_person` ON `feed_likes` (`checkin_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair` ON `friendships` (`requester_id`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `friendships_recipient` ON `friendships` (`recipient_id`);--> statement-breakpoint
CREATE TABLE `habit_visibility` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` text NOT NULL,
	`kind` text NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'group' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_visibility_person_kind_slot` ON `habit_visibility` (`person_id`,`kind`,`slot`);--> statement-breakpoint
ALTER TABLE `people` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `people` ADD `avatar_type` text;