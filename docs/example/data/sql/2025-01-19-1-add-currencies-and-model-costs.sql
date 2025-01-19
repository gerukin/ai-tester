-- SQLite dialect

INSERT INTO currencies ("iso_4217_code") VALUES ('USD'), ('JPY');

INSERT INTO currency_rates ("currency_id", "rate_in_usd", "valid_from")
VALUES
	(
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),
		1,

		-- valid from the first date for the sessions table entries
		COALESCE(COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now')), strftime('%s', 'now'))
	),
	(
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),
		0.0064,

		-- valid from the first date for the sessions table entries
		COALESCE(COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now')), strftime('%s', 'now'))
	)
;

INSERT INTO model_costs (
		"model_version_id",
		"currency_id",
		"cost_per_call",
		"cost_per_prompt_token",
		"cost_per_completion_token",
		"cost_per_hour",
		"valid_from"
	)
VALUES
	-- Ollama
	-- For local Ollama models, we calculate the cost of electricity for each token (in Japan)
	-- Cost of electricity: ~30 JPY per kWh
	-- Power consumption is that of an M1 pro during generation as baseline (measured on average)
	-- Cost of electricity per hour: {consumption for this model} kW * 30 JPY * 1.5 (upward buffer) = {cost}
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'phi3.5:3.8b-mini-instruct-q8_0'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.015 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'phi4:14b-q4_K_M'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.022 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gemma2:2b-instruct-q8_0'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.015 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gemma2:9b-instruct-q4_K_M'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.021 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'llama3.2:3b-instruct-q8_0'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.016 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'llama3.2-vision:11b-instruct-q4_K_M'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.022 * 30 * 1.5,

		-- valid from the first date for
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'mistral-nemo:12b-instruct-2407-q4_K_M'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.022 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'smallthinker:3b-preview-q8_0'
				AND provider_id = (SELECT id FROM providers WHERE code = 'ollama')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		0,
		0,
		0,
		0.015 * 30 * 1.5,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),

	-- OpenAI
	-- For OpenAI models, we use the cost per token and cost per hour provided by OpenAI
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gpt-4o-2024-08-06'
				AND provider_id = (SELECT id FROM providers WHERE code = 'openai')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		0,
		2.5/1000000,
		10/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gpt-4o-mini-2024-07-18'
				AND provider_id = (SELECT id FROM providers WHERE code = 'openai')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		0,
		0.15/1000000,
		0.6/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'o1-2024-12-17'
				AND provider_id = (SELECT id FROM providers WHERE code = 'openai')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		0,
		15/1000000,
		60/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'o1-mini-2024-09-12'
				AND provider_id = (SELECT id FROM providers WHERE code = 'openai')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		0,
		3/1000000,
		12/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),

	-- Google (on Vertex)
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gemini-1.5-pro-002'
				AND provider_id = (SELECT id FROM providers WHERE code = 'vertex')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),

		-- https://cloud.google.com/skus?hl=en&filter=Gemini%201.5%20Pro&currency=JPY
		0,
		0.049295312/1000,
		0.19718125/1000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gemini-1.5-flash-002'
				AND provider_id = (SELECT id FROM providers WHERE code = 'vertex')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		-- https://cloud.google.com/skus?hl=en&filter=Gemini%201.5%20flash&currency=JPY
		0,
		0.002957719/1000,
		0.011830875/1000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gemini-2.0-flash-exp'
				AND provider_id = (SELECT id FROM providers WHERE code = 'vertex')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		-- Pricing for gemini-2.0-flash-exp on Vertex is not available as of now and assumed to be 0
		0,
		0,
		0,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'gemini-2.0-flash-thinking-exp-1219'
				AND provider_id = (SELECT id FROM providers WHERE code = 'vertex')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		-- Pricing for gemini-2.0-flash-thinking-exp-1219 on Vertex is not available as of now and assumed to be 0
		0,
		0,
		0,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),

	-- Anthropic (on Vertex)
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'claude-3-5-sonnet-v2@20241022'
				AND provider_id = (SELECT id FROM providers WHERE code = 'vertex')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		0,
		3/1000000,
		15/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'claude-3-5-haiku@20241022'
				AND provider_id = (SELECT id FROM providers WHERE code = 'vertex')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		0,
		0.8/1000000,
		4/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),

	-- Perplexity
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'llama-3.1-sonar-small-128k-online'
				AND provider_id = (SELECT id FROM providers WHERE code = 'perplexity')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		5/1000,
		0.2/1000000,
		0.2/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'llama-3.1-sonar-large-128k-online'
				AND provider_id = (SELECT id FROM providers WHERE code = 'perplexity')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		5/1000,
		1/1000000,
		1/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	),
	(
		(
			SELECT id
			FROM model_versions
			WHERE
				provider_model_code = 'llama-3.1-sonar-huge-128k-online'
				AND provider_id = (SELECT id FROM providers WHERE code = 'perplexity')
		),
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),

		5/1000,
		5/1000000,
		5/1000000,
		0,

		-- valid from the first date for the sessions table entries
		COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now'))
	)
;
