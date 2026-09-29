ALTER TABLE `group_goals` ADD `weekly_day` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `group_goals` SET `weekly_day`=6 WHERE `kind`='drinks' AND `cadence`='weekly';
--> statement-breakpoint
CREATE TABLE `personal_goals` (
 `id` text PRIMARY KEY NOT NULL, `person_id` text NOT NULL, `kind` text NOT NULL,
 `slot` integer DEFAULT 0 NOT NULL, `title` text NOT NULL, `cadence` text NOT NULL,
 `preferred_minutes` integer DEFAULT 720 NOT NULL, `weekly_day` integer DEFAULT 0 NOT NULL,
 `active` integer DEFAULT 1 NOT NULL, `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `personal_goals_person` ON `personal_goals` (`person_id`);
--> statement-breakpoint
ALTER TABLE `personal_goal_edits` ADD `weekly_day` integer;
--> statement-breakpoint
ALTER TABLE `personal_goal_edits` ADD `preferred_minutes` integer;
--> statement-breakpoint
ALTER TABLE `group_goals` ADD `sort_rank` integer;