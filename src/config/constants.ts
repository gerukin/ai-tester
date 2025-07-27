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
	DEFAULT_CONFIG_FILE_PATH = 'ai-tester.config.yaml',
	/**
	 * The maximum reasoning effort in a test
	 */
	MAX_TEST_REASONING_EFFORT = 'low',
	/**
	 * The maximum reasoning effort in an evaluation
	 */
	MAX_EVALUATION_REASONING_EFFORT = 'low',
	/**
	 * The maximum number of tokens the model can use to answer a test.
	 */
	/**
	 * The maximum number of tokens the model can use to answer a test.
	 * Should always be greater than or equal to MAX_TEST_THINKING_TOKENS.
	 */
	MAX_TEST_OUTPUT_TOKENS = 7000,
	/**
	 * The maximum number of tokens the model can use to think about the test.
	 * Should always be less than or equal to MAX_TEST_OUTPUT_TOKENS.
	 */
	MAX_TEST_THINKING_TOKENS = 5000,
	/**
	 * The maximum number of tokens the model can use to generate an evaluation.
	 * Should always be greater than or equal to MAX_EVALUATION_THINKING_TOKENS.
	 */
	MAX_EVALUATION_OUTPUT_TOKENS = 2500,
	/**
	 * The maximum number of tokens the model can use to think about the evaluation.
	 * Should always be less than or equal to MAX_EVALUATION_OUTPUT_TOKENS.
	 */
	MAX_EVALUATION_THINKING_TOKENS = 2000,
	/**
	 * TODO: 120s - to improve!
	 *
	 * The maximum time the model can take to answer a test or an evaluation.
	 */
	DEFAULT_MAX_WAIT_TIME = 1000 * 120 // 120 seconds
