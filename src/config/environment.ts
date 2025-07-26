import dotenv from 'dotenv'
import { z } from 'zod'

import { DEFAULT_MAX_WAIT_TIME, DEFAULT_CONFIG_FILE_PATH } from './constants.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

export const envConfig = z
	.object({
		AI_TESTER_OLLAMA_BASE_URL: z.string().url().optional(),
		AI_TESTER_SQLITE_DB_PATH: z.string().min(2),
		AI_TESTER_TESTS_DIR: z.string().min(1),
		AI_TESTER_PROMPTS_DIR: z.string().min(1),
		AI_TESTER_STRUCTURED_SCHEMAS_DIR: z.string().min(1).optional(),
		AI_TESTER_TOOL_DEFINITIONS_DIR: z.string().min(1).optional(),
		AI_TESTER_CONFIG_PATH: z.string().min(1).optional().default(DEFAULT_CONFIG_FILE_PATH),

		// Vertex AI config
		GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
		GOOGLE_VERTEX_AI_REGION: z.string().min(1).optional(),
		GOOGLE_VERTEX_AI_PROJECT: z.string().min(1).optional(),

		// OpenAI config
		OPENAI_API_KEY: z.string().min(10).optional(),

		// Perplexity config
		PERPLEXITY_API_KEY: z.string().min(10).optional(),

		// Max wait time config
		MAX_WAIT_TIME: z.coerce.number().optional().default(DEFAULT_MAX_WAIT_TIME),
	})
	.parse({
		AI_TESTER_OLLAMA_BASE_URL: process.env['AI_TESTER_OLLAMA_BASE_URL'],
		AI_TESTER_SQLITE_DB_PATH: process.env['AI_TESTER_SQLITE_DB_PATH'],
		AI_TESTER_TESTS_DIR: process.env['AI_TESTER_TESTS_DIR'],
		AI_TESTER_PROMPTS_DIR: process.env['AI_TESTER_PROMPTS_DIR'],
		AI_TESTER_STRUCTURED_SCHEMAS_DIR: process.env['AI_TESTER_STRUCTURED_SCHEMAS_DIR'],
		AI_TESTER_TOOL_DEFINITIONS_DIR: process.env['AI_TESTER_TOOL_DEFINITIONS_DIR'],
		AI_TESTER_CONFIG_PATH: process.env['AI_TESTER_CONFIG_PATH'],

		// Provider configs
		GOOGLE_APPLICATION_CREDENTIALS: process.env['GOOGLE_APPLICATION_CREDENTIALS'],
		GOOGLE_VERTEX_AI_REGION: process.env['GOOGLE_VERTEX_AI_REGION'],
		GOOGLE_VERTEX_AI_PROJECT: process.env['GOOGLE_VERTEX_AI_PROJECT'],

		// OpenAI config
		OPENAI_API_KEY: process.env['OPENAI_API_KEY'],

		// Perplexity config
		PERPLEXITY_API_KEY: process.env['PERPLEXITY_API_KEY'],

		// Max wait time config
		MAX_WAIT_TIME: process.env['MAX_WAIT_TIME'],
	})
