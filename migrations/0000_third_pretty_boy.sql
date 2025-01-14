CREATE TABLE `model_versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`model_id` integer NOT NULL,
	`provider_id` integer NOT NULL,
	`provider_model_code` text NOT NULL,
	`extra_identifier` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`prompt_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hash` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_evaluations` (
	`id` integer PRIMARY KEY NOT NULL,
	`session_id` integer NOT NULL,
	`evaluation_prompt_version_id` integer NOT NULL,
	`test_evaluation_instructions_version_id` integer NOT NULL,
	`model_version_id` integer NOT NULL,
	`temperature` real NOT NULL,
	`pass` integer NOT NULL,
	`feedback` text,
	`completion_tokens` integer NOT NULL,
	`prompt_tokens` integer NOT NULL,
	`time_taken` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`evaluation_prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`test_evaluation_instructions_version_id`) REFERENCES `test_evaluation_instructions_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`model_version_id`) REFERENCES `model_versions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`test_version_id` integer NOT NULL,
	`candidate_sys_prompt_version_id` integer NOT NULL,
	`model_version_id` integer NOT NULL,
	`temperature` real NOT NULL,
	`answer` text NOT NULL,
	`completion_tokens` integer NOT NULL,
	`prompt_tokens` integer NOT NULL,
	`time_taken` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`test_version_id`) REFERENCES `test_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`candidate_sys_prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`model_version_id`) REFERENCES `model_versions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prompt_to_tag_rels` (
	`tag_id` integer NOT NULL,
	`prompt_id` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `prompt_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_to_tag_rels` (
	`tag_id` integer NOT NULL,
	`test_version_id` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `test_version_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`test_version_id`) REFERENCES `test_versions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_evaluation_instructions_versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hash` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_to_evaluation_instructions_rels` (
	`test_version_id` integer NOT NULL,
	`evaluation_instructions_version_id` integer NOT NULL,
	PRIMARY KEY(`test_version_id`, `evaluation_instructions_version_id`),
	FOREIGN KEY (`test_version_id`) REFERENCES `test_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`evaluation_instructions_version_id`) REFERENCES `test_evaluation_instructions_versions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_to_system_prompt_version_rels` (
	`test_version_id` integer NOT NULL,
	`system_prompt_version_id` integer NOT NULL,
	PRIMARY KEY(`test_version_id`, `system_prompt_version_id`),
	FOREIGN KEY (`test_version_id`) REFERENCES `test_versions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`system_prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hash` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_versions_provider_id_provider_model_code_extra_identifier_unique` ON `model_versions` (`provider_id`,`provider_model_code`,`extra_identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `models_code_unique` ON `models` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_versions_prompt_id_hash_unique` ON `prompt_versions` (`prompt_id`,`hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompts_code_unique` ON `prompts` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `providers_code_unique` ON `providers` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `providers_name_unique` ON `providers` (`name`);--> statement-breakpoint
CREATE INDEX `combined_evaluation_idx` ON `session_evaluations` (`model_version_id`,`session_id`,`evaluation_prompt_version_id`,`temperature`);--> statement-breakpoint
CREATE INDEX `session_id_idx` ON `session_evaluations` (`session_id`);--> statement-breakpoint
CREATE INDEX `combined_session_idx` ON `sessions` (`model_version_id`,`test_version_id`,`candidate_sys_prompt_version_id`,`temperature`);--> statement-breakpoint
CREATE INDEX `test_id_idx` ON `sessions` (`test_version_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `test_evaluation_instructions_versions_hash_unique` ON `test_evaluation_instructions_versions` (`hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `test_versions_hash_unique` ON `test_versions` (`hash`);