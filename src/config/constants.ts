import { envConfig } from './environment.js'

/**
 * Special tags that have a special meaning in the tests or prompts. Tests and prompts can have multiple special tags.
 *
 * Special tags start with an underscore. Users are not allowed to create tags starting with an underscore.
 *
 * 🚨 Changing the keys will likely rerun associated tests and evaluations.
 * Changing the config for a tag will result in old runs having a different meaning from new ones.
 * It is recommended to add new tags instead of changing existing ones. Old tags can be deprecated.
 */
export const SPECIAL_TAGS = new Map([
	[
		'_evaluator',
		{
			evaluator: true,
		},
	],
	[
		'_json_mode',
		{
			jsonMode: true,
		},
	],
	[
		'_has_tools',
		{
			hasTools: true,
		},
	],
	[
		'_tools_only',
		{
			toolsOnly: true,
		},
	],
])

export const DEFAULT_TEMPERATURE = 0.3,
	DEFAULT_ATTEMPTS = 1,
	DEFAULT_EVALUATIONS = 3,
	DEFAULT_PROHIBITED_TAGS = ['skip', 'example'],
	CONFIG_FILE_PATH = envConfig.AI_TESTER_CONFIG_PATH ?? 'ai-tester.config.yaml',
	/** TODO: to improve (this is a very blunt instrument) */
	MAX_TOKENS = 500,
	/** TODO: 20s - to improve (this is a very blunt instrument) */
	MAX_WAIT_TIME = 1000 * 20 // 20 seconds
