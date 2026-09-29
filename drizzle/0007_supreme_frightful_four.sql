CREATE TABLE `personal_goal_edits` (
 `goal_id` text NOT NULL,
 `person_id` text NOT NULL,
 `title` text NOT NULL,
 `cadence` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_goal_edits_pair` ON `personal_goal_edits` (`goal_id`,`person_id`);