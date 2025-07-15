CREATE TABLE `structured_object_versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`structured_object_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hash` text NOT NULL,
	`schema` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`structured_object_id`) REFERENCES `structured_objects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `structured_object_versions_structured_object_id_hash_unique` ON `structured_object_versions` (`structured_object_id`,`hash`);--> statement-breakpoint
CREATE TABLE `structured_objects` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `structured_objects_code_unique` ON `structured_objects` (`code`);--> statement-breakpoint
ALTER TABLE `test_versions` ADD `structured_object_version_id` integer REFERENCES structured_object_versions(id);