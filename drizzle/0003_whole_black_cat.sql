ALTER TABLE `checkins` ADD `logged_time` text;--> statement-breakpoint
ALTER TABLE `checkins` ADD `details` text;--> statement-breakpoint
ALTER TABLE `circles` ADD `color` text DEFAULT '#5B5FC7' NOT NULL;--> statement-breakpoint
UPDATE circles SET color = CASE ((SELECT COUNT(*) FROM circles prior WHERE prior.created_at < circles.created_at OR (prior.created_at = circles.created_at AND prior.id < circles.id)) % 8)
 WHEN 0 THEN '#5B5FC7' WHEN 1 THEN '#CB5B73' WHEN 2 THEN '#C27A24' WHEN 3 THEN '#267F9D'
 WHEN 4 THEN '#8159A8' WHEN 5 THEN '#B45A49' WHEN 6 THEN '#287B75' ELSE '#8C6480' END;
