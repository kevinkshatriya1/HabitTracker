CREATE TABLE `goal_order` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` text NOT NULL,
	`kind` text NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`rank` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_order_person_kind_slot` ON `goal_order` (`person_id`,`kind`,`slot`);--> statement-breakpoint
ALTER TABLE `group_goals` ADD `preferred_minutes` integer DEFAULT 720 NOT NULL;--> statement-breakpoint
UPDATE group_goals SET preferred_minutes = CASE
 WHEN kind='wake' THEN 420 WHEN kind='makebed' THEN 440
 WHEN kind='workout' AND slot=0 THEN 1020 WHEN kind='workout' AND slot=1 THEN 1140
 WHEN kind='bed' THEN 1380 WHEN kind='prep' THEN 660 WHEN kind='drinks' THEN 1200
 WHEN LOWER(title) LIKE '%morning%' THEN 480 WHEN LOWER(title) LIKE '%dinner%' THEN 1080
 WHEN LOWER(title) LIKE '%read%' THEN 1260 WHEN LOWER(title) LIKE '%walk%' THEN 900
 ELSE 720 END;
--> statement-breakpoint
UPDATE circles SET color = CASE ((SELECT COUNT(*) FROM circles previous WHERE previous.created_at < circles.created_at OR (previous.created_at = circles.created_at AND previous.id < circles.id)) % 8)
 WHEN 0 THEN '#4566B5' WHEN 1 THEN '#128390' WHEN 2 THEN '#805AA8' WHEN 3 THEN '#B47A2B'
 WHEN 4 THEN '#B25F82' WHEN 5 THEN '#367E6B' WHEN 6 THEN '#5978A1' ELSE '#B9664E' END;
