CREATE TABLE `test_to_tool_version_rels` (
	`test_version_id` integer NOT NULL,
	`tool_version_id` integer NOT NULL,
	PRIMARY KEY(`test_version_id`, `tool_version_id`),
	FOREIGN KEY (`test_version_id`) REFERENCES `test_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tool_version_id`) REFERENCES `tool_versions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tool_versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`tool_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hash` text NOT NULL,
	`schema` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_versions_tool_id_hash_unique` ON `tool_versions` (`tool_id`,`hash`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tools_code_unique` ON `tools` (`code`);