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
	/**
	 * TODO: 1500 to improve!
	 *
	 * This is a very blunt instrument. Some models, like reasoning models, need more.
	 * Some tests should pass with few tokens and others should be allowed to use more.
	 * Whether the model responds under an acceptable token limit could be used to consider whether the test is passed.
	 */
	MAX_TOKENS = 1500,
	/**
	 * TODO: 120s - to improve!
	 *
	 * This is a very blunt instrument. Some models, like reasoning models, need more.
	 * Some tests should pass quickly and others should be allowed to take longer.
	 * Whether the model responds within an acceptable time frame could be used to consider whether the test is passed.
	 */
	MAX_WAIT_TIME = 1000 * 120 // 120 seconds
