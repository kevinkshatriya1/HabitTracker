CREATE TABLE `goal_choices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` text NOT NULL,
	`person_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_choices_goal_person` ON `goal_choices` (`goal_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `goal_choices_person` ON `goal_choices` (`person_id`);--> statement-breakpoint
CREATE TABLE `group_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`kind` text NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`cadence` text NOT NULL,
	`target` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_goals_circle_kind_slot` ON `group_goals` (`circle_id`,`kind`,`slot`);--> statement-breakpoint
CREATE INDEX `group_goals_circle` ON `group_goals` (`circle_id`);