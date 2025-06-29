import { envConfig } from './environment.js';
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
]);
export const DEFAULT_TEMPERATURE = 0.3, DEFAULT_ATTEMPTS = 1, DEFAULT_EVALUATIONS = 3, DEFAULT_PROHIBITED_TAGS = ['skip', 'example'], CONFIG_FILE_PATH = envConfig.AI_TESTER_CONFIG_PATH ?? 'ai-tester.config.yaml', 
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
MAX_TEST_OUTPUT_TOKENS = 2000, 
/**
 * The maximum number of tokens the model can use to think about the test.
 */
MAX_TEST_THINKING_TOKENS = 5000, 
/**
 * The maximum number of tokens the model can use to generate an evaluation.
 */
MAX_EVALUATION_OUTPUT_TOKENS = 500, 
/**
 * The maximum number of tokens the model can use to think about the evaluation.
 */
MAX_EVALUATION_THINKING_TOKENS = 2000, 
/**
 * TODO: 120s - to improve!
 *
 * The maximum time the model can take to answer a test or an evaluation.
 */
MAX_WAIT_TIME = 1000 * 120; // 120 seconds
