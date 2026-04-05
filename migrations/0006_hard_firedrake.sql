ALTER TABLE `model_versions` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `providers` ADD `active` integer DEFAULT true NOT NULL;