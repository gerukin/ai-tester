PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_currency_rates` (
	`id` integer PRIMARY KEY NOT NULL,
	`currency_id` integer NOT NULL,
	`rate_in_usd` real NOT NULL,
	`valid_from` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_currency_rates`("id", "currency_id", "rate_in_usd", "valid_from") SELECT "id", "currency_id", "rate_in_usd", "valid_from" FROM `currency_rates`;--> statement-breakpoint
DROP TABLE `currency_rates`;--> statement-breakpoint
ALTER TABLE `__new_currency_rates` RENAME TO `currency_rates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `currency_rates_currency_id_valid_from_unique` ON `currency_rates` (`currency_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `__new_model_costs` (
	`id` integer PRIMARY KEY NOT NULL,
	`model_version_id` integer NOT NULL,
	`currency_id` integer NOT NULL,
	`cost_per_call` real NOT NULL,
	`cost_per_prompt_token` real NOT NULL,
	`cost_per_completion_token` real NOT NULL,
	`cost_per_hour` real NOT NULL,
	`valid_from` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_model_costs`("id", "model_version_id", "currency_id", "cost_per_call", "cost_per_prompt_token", "cost_per_completion_token", "cost_per_hour", "valid_from") SELECT "id", "model_version_id", "currency_id", "cost_per_call", "cost_per_prompt_token", "cost_per_completion_token", "cost_per_hour", "valid_from" FROM `model_costs`;--> statement-breakpoint
DROP TABLE `model_costs`;--> statement-breakpoint
ALTER TABLE `__new_model_costs` RENAME TO `model_costs`;--> statement-breakpoint
CREATE UNIQUE INDEX `model_costs_model_version_id_valid_from_unique` ON `model_costs` (`model_version_id`,`valid_from`);