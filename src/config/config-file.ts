import fs from 'node:fs'
import yaml from 'yaml'
import { z } from 'zod'

import {
	CONFIG_FILE_PATH,
	DEFAULT_TEMPERATURE,
	DEFAULT_ATTEMPTS,
	DEFAULT_PROHIBITED_TAGS,
	DEFAULT_EVALUATIONS,
} from './constants.js'

// if the config file is not found, we throw an error
if (!fs.existsSync(CONFIG_FILE_PATH)) {
	throw new Error(`Config file not found at ${CONFIG_FILE_PATH}`)
}

export const testsConfig = z
	.object({
		/** Models to test */
		candidates: z.array(
			z.object({
				provider: z.string(),
				model: z.string(),

				/** Tags to include in this session for this candidate only (not provided means no restrictions) */
				requiredTags: z.array(z.string()).optional(),

				/** Tags to exclude from this session for this candidate only (not provided means no restrictions) */
				prohibitedTags: z.array(z.string()).optional(),

				/** Temperature to apply to this model for this session only */
				temperature: z.number().min(0).max(1).optional(),
			})
		),

		/**
		 * Default temperature to apply to all models being tested
		 * Note: the tests will be re-run for each different temperature
		 */
		candidatesTemperature: z.number().min(0).max(1).default(DEFAULT_TEMPERATURE),

		/** Number of responses generated per test */
		attempts: z.number().min(1).default(DEFAULT_ATTEMPTS),

		/** Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags2) */
		requiredTags1: z.array(z.string()).default([]),

		/** Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags1) */
		requiredTags2: z.array(z.string()).default([]),

		/** Test tags to exclude from this run (the test runs if it does not match any of the tags) */
		prohibitedTags: z.array(z.string()).default(DEFAULT_PROHIBITED_TAGS),

		/**
		 * Models to use to evaluate the generated responses
		 * Note: if multiple models could be used for a given evaluation, the ones highest in this list are used
		 */
		evaluators: z.array(
			z.object({
				provider: z.string(),
				model: z.string(),

				/** Tags to include in this session for this evaluator only (not provided means no restrictions) */
				requiredTags: z.array(z.string()).optional(),

				/** Tags to exclude from this session for this evaluator only (not provided means no restrictions) */
				prohibitedTags: z.array(z.string()).optional(),

				/** Temperature to apply to this model for this session only */
				temperature: z.number().min(0).max(1).optional(),
			})
		),

		/**
		 * Default temperature to apply to all evaluators
		 * Note: the tests will be re-run for each different temperature
		 */
		evaluatorsTemperature: z.number().min(0).max(1).default(DEFAULT_TEMPERATURE),

		/** Total number of evaluations per response per evaluator */
		evaluationsPerEvaluator: z.number().min(1).default(DEFAULT_EVALUATIONS),
	})
	.parse(yaml.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8')))
