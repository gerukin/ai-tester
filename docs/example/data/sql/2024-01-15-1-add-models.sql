-- SQLite dialect

INSERT INTO providers ("code", "name")
VALUES
	('ollama', 'Ollama'),
	('openai', 'OpenAI'),
	('vertex', 'Vertex AI'),
	('perplexity', 'Perplexity')
;

INSERT INTO models ("code")
VALUES
	-- Ollama
	('phi3.5-3.8b'),
	('phi4:14b'),
	('gemma2-2b'),
	('gemma2-9b'),
	('llama3.2-3b'),
	('llama3.2-vision-11b'),
	('mistral-nemo-12b'),
	('smallthinker-3b-preview'),

	-- OpenAI
	('gpt-4o'),
	('gpt-4o-mini'),
	('o1'),
	('o1-mini'),

	-- Google
	('gemini-1.5-pro'),
	('gemini-1.5-flash'),
	('gemini-2.0-flash'),
	('gemini-2.0-flash-thinking'),

	-- Anthropic
	('claude-3-5-sonnet'),
	('claude-3-5-haiku'),

	-- Perplexity
	('llama-3.1-sonar-small-128k-online'),
	('llama-3.1-sonar-large-128k-online'),
	('llama-3.1-sonar-huge-128k-online')
;

INSERT INTO model_versions (
		"model_id",
		"provider_id",
		"provider_model_code",
		"extra_identifier"
	)
VALUES
	-- Ollama
	(
		(SELECT id FROM models WHERE code = 'phi3.5-3.8b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'phi3.5:3.8b-mini-instruct-q8_0',
		'8b50e8e1e216'
	),
	(
		(SELECT id FROM models WHERE code = 'phi4:14b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'phi4:14b-q4_K_M',
		'ac896e5b8b34'
	),
	(
		(SELECT id FROM models WHERE code = 'gemma2-2b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'gemma2:2b-instruct-q8_0',
		'9d27a8c2325c'
	),
	(
		(SELECT id FROM models WHERE code = 'gemma2-9b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'gemma2:9b-instruct-q4_K_M',
		'c20bec88025f'
	),
	(
		(SELECT id FROM models WHERE code = 'llama3.2-3b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'llama3.2:3b-instruct-q8_0',
		'e410b836fe61'
	),
	(
		(SELECT id FROM models WHERE code = 'llama3.2-vision-11b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'llama3.2-vision:11b-instruct-q4_K_M',
		'085a1fdae525'
	),
	(
		(SELECT id FROM models WHERE code = 'mistral-nemo-12b'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'mistral-nemo:12b-instruct-2407-q4_K_M',
		'1da0ebbdb7ca'
	),
	(
		(SELECT id FROM models WHERE code = 'smallthinker-3b-preview'),
		(SELECT id FROM providers WHERE code = 'ollama'),
		'smallthinker:3b-preview-q8_0',
		'945eb1864589'
	),

	-- OpenAI
	(
		(SELECT id FROM models WHERE code = 'gpt-4o'),
		(SELECT id FROM providers WHERE code = 'openai'),
		'gpt-4o-2024-08-06',
		NULL
	),
	(
		(SELECT id FROM models WHERE code = 'gpt-4o-mini'),
		(SELECT id FROM providers WHERE code = 'openai'),
		'gpt-4o-mini-2024-07-18',
		NULL
	),
	(
		(SELECT id FROM models WHERE code = 'o1'),
		(SELECT id FROM providers WHERE code = 'openai'),
		'o1-2024-12-17',
		NULL
	),
	(
		(SELECT id FROM models WHERE code = 'o1-mini'),
		(SELECT id FROM providers WHERE code = 'openai'),
		'o1-mini-2024-09-12',
		NULL
	),

	-- Google
	(
		(SELECT id FROM models WHERE code = 'gemini-1.5-pro'),
		(SELECT id FROM providers WHERE code = 'vertex'),
		'gemini-1.5-pro-002',
		'publishers/google/models/gemini-1.5-pro-002'
	),
	(
		(SELECT id FROM models WHERE code = 'gemini-1.5-flash'),
		(SELECT id FROM providers WHERE code = 'vertex'),
		'gemini-1.5-flash-002',
		'publishers/google/models/gemini-1.5-flash-002'
	),
	(
		(SELECT id FROM models WHERE code = 'gemini-2.0-flash'),
		(SELECT id FROM providers WHERE code = 'vertex'),
		'gemini-2.0-flash-exp',
		'publishers/google/models/gemini-2.0-flash-exp'
	),
	(
		(SELECT id FROM models WHERE code = 'gemini-2.0-flash-thinking'),
		(SELECT id FROM providers WHERE code = 'vertex'),
		'gemini-2.0-flash-thinking-exp-1219',
		'publishers/google/models/gemini-2.0-flash-thinking-exp-1219'
	),

	-- Anthropic
	(
		(SELECT id FROM models WHERE code = 'claude-3-5-sonnet'),
		(SELECT id FROM providers WHERE code = 'vertex'),
		'claude-3-5-sonnet-v2@20241022',
		'publishers/anthropic/models/claude-3-5-sonnet-v2'
	),
	(
		(SELECT id FROM models WHERE code = 'claude-3-5-haiku'),
		(SELECT id FROM providers WHERE code = 'vertex'),
		'claude-3-5-haiku@20241022',
		'publishers/anthropic/models/claude-3-5-haiku'
	),

	-- Perplexity
	(
		(SELECT id FROM models WHERE code = 'llama-3.1-sonar-small-128k-online'),
		(SELECT id FROM providers WHERE code = 'perplexity'),
		'llama-3.1-sonar-small-128k-online',
		NULL
	),
	(
		(SELECT id FROM models WHERE code = 'llama-3.1-sonar-large-128k-online'),
		(SELECT id FROM providers WHERE code = 'perplexity'),
		'llama-3.1-sonar-large-128k-online',
		NULL
	),
	(
		(SELECT id FROM models WHERE code = 'llama-3.1-sonar-huge-128k-online'),
		(SELECT id FROM providers WHERE code = 'perplexity'),
		'llama-3.1-sonar-huge-128k-online',
		NULL
	)
;
