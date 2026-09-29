CREATE TABLE `friend_notification_preferences` (
 `person_id` text NOT NULL,
 `friend_id` text NOT NULL,
 `enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_notification_preferences_pair` ON `friend_notification_preferences` (`person_id`,`friend_id`);
--> statement-breakpoint
ALTER TABLE `checkins` ADD `status` text DEFAULT 'completed' NOT NULL;