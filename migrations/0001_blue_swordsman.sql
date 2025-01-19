CREATE TABLE `currencies` (
	`id` integer PRIMARY KEY NOT NULL,
	`iso_4217_code` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `currency_rates` (
	`id` integer PRIMARY KEY NOT NULL,
	`currency_id` integer NOT NULL,
	`rate_in_usd` integer NOT NULL,
	`valid_from` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_costs` (
	`id` integer PRIMARY KEY NOT NULL,
	`model_version_id` integer NOT NULL,
	`currency_id` integer NOT NULL,
	`cost_per_call` integer NOT NULL,
	`cost_per_prompt_token` integer NOT NULL,
	`cost_per_completion_token` integer NOT NULL,
	`cost_per_hour` integer NOT NULL,
	`valid_from` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `session_evaluations` ADD `cached_prompt_tokens` integer;--> statement-breakpoint
ALTER TABLE `session_evaluations` ADD `cached_prompt_tokens_read` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `cached_prompt_tokens` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `cached_prompt_tokens_read` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `currencies_iso_4217_code_unique` ON `currencies` (`iso_4217_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `currency_rates_currency_id_valid_from_unique` ON `currency_rates` (`currency_id`,`valid_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_costs_model_version_id_valid_from_unique` ON `model_costs` (`model_version_id`,`valid_from`);