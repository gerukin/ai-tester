import dotenv from 'dotenv'
import { z } from 'zod'

import {
	DEFAULT_MAX_WAIT_TIME,
	DEFAULT_CONFIG_FILE_PATH,
	MAX_TEST_OUTPUT_TOKENS,
	MAX_TEST_THINKING_TOKENS,
	MAX_EVALUATION_OUTPUT_TOKENS,
	MAX_EVALUATION_THINKING_TOKENS,
} from './constants.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

export const envConfig = z
	.object({
		AI_TESTER_SQLITE_DB_PATH: z.string().min(2),
		AI_TESTER_LOGS_DIR: z.string().min(1),
		AI_TESTER_TESTS_DIR: z.string().min(1),
		AI_TESTER_PROMPTS_DIR: z.string().min(1),
		AI_TESTER_STRUCTURED_SCHEMAS_DIR: z.string().min(1).optional(),
		AI_TESTER_TOOL_DEFINITIONS_DIR: z.string().min(1).optional(),
		AI_TESTER_CONFIG_PATH: z.string().min(1).optional().default(DEFAULT_CONFIG_FILE_PATH),

		// Max wait time config
		MAX_WAIT_TIME: z.coerce.number().optional().default(DEFAULT_MAX_WAIT_TIME),

		// Max tokens config (all optional, default to constants)
		MAX_TEST_OUTPUT_TOKENS: z.coerce.number().optional().default(MAX_TEST_OUTPUT_TOKENS),
		MAX_TEST_THINKING_TOKENS: z.coerce.number().optional().default(MAX_TEST_THINKING_TOKENS),
		MAX_EVALUATION_OUTPUT_TOKENS: z.coerce.number().optional().default(MAX_EVALUATION_OUTPUT_TOKENS),
		MAX_EVALUATION_THINKING_TOKENS: z.coerce.number().optional().default(MAX_EVALUATION_THINKING_TOKENS),

		// Ollama config
		AI_TESTER_OLLAMA_BASE_URL: z.string().url().optional(),

		// Vertex AI config
		GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
		GOOGLE_VERTEX_AI_REGION: z.string().min(1).optional(),
		GOOGLE_VERTEX_AI_PROJECT: z.string().min(1).optional(),

		// OpenAI config
		OPENAI_API_KEY: z.string().min(10).optional(),

		// Perplexity config
		PERPLEXITY_API_KEY: z.string().min(10).optional(),
	})
	.refine(obj => obj.MAX_TEST_OUTPUT_TOKENS > obj.MAX_TEST_THINKING_TOKENS, {
		message: 'MAX_TEST_OUTPUT_TOKENS must be greater than MAX_TEST_THINKING_TOKENS',
		path: ['MAX_TEST_OUTPUT_TOKENS', 'MAX_TEST_THINKING_TOKENS'],
	})
	.refine(obj => obj.MAX_EVALUATION_OUTPUT_TOKENS > obj.MAX_EVALUATION_THINKING_TOKENS, {
		message: 'MAX_EVALUATION_OUTPUT_TOKENS must be greater than MAX_EVALUATION_THINKING_TOKENS',
		path: ['MAX_EVALUATION_OUTPUT_TOKENS', 'MAX_EVALUATION_THINKING_TOKENS'],
	})
	.parse({
		AI_TESTER_LOGS_DIR: process.env['AI_TESTER_LOGS_DIR'],
		AI_TESTER_SQLITE_DB_PATH: process.env['AI_TESTER_SQLITE_DB_PATH'],
		AI_TESTER_TESTS_DIR: process.env['AI_TESTER_TESTS_DIR'],
		AI_TESTER_PROMPTS_DIR: process.env['AI_TESTER_PROMPTS_DIR'],
		AI_TESTER_STRUCTURED_SCHEMAS_DIR: process.env['AI_TESTER_STRUCTURED_SCHEMAS_DIR'],
		AI_TESTER_TOOL_DEFINITIONS_DIR: process.env['AI_TESTER_TOOL_DEFINITIONS_DIR'],
		AI_TESTER_CONFIG_PATH: process.env['AI_TESTER_CONFIG_PATH'],

		// Max wait time config
		MAX_WAIT_TIME: process.env['MAX_WAIT_TIME'],

		// Max tokens config
		MAX_TEST_OUTPUT_TOKENS: process.env['MAX_TEST_OUTPUT_TOKENS'],
		MAX_TEST_THINKING_TOKENS: process.env['MAX_TEST_THINKING_TOKENS'],
		MAX_EVALUATION_OUTPUT_TOKENS: process.env['MAX_EVALUATION_OUTPUT_TOKENS'],
		MAX_EVALUATION_THINKING_TOKENS: process.env['MAX_EVALUATION_THINKING_TOKENS'],

		// Ollama config
		AI_TESTER_OLLAMA_BASE_URL: process.env['AI_TESTER_OLLAMA_BASE_URL'],

		// Provider configs
		GOOGLE_APPLICATION_CREDENTIALS: process.env['GOOGLE_APPLICATION_CREDENTIALS'],
		GOOGLE_VERTEX_AI_REGION: process.env['GOOGLE_VERTEX_AI_REGION'],
		GOOGLE_VERTEX_AI_PROJECT: process.env['GOOGLE_VERTEX_AI_PROJECT'],

		// OpenAI config
		OPENAI_API_KEY: process.env['OPENAI_API_KEY'],

		// Perplexity config
		PERPLEXITY_API_KEY: process.env['PERPLEXITY_API_KEY'],
	})
