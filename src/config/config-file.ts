import fs from 'node:fs'
import yaml from 'yaml'
import { z } from 'zod'

import { DEFAULT_TEMPERATURE, DEFAULT_ATTEMPTS, DEFAULT_PROHIBITED_TAGS, DEFAULT_EVALUATIONS } from './constants.js'
import { envConfig } from './environment.js'

// if the config file is not found, we throw an error
if (!fs.existsSync(envConfig.AI_TESTER_CONFIG_PATH)) {
	throw new Error(`Config file not found at ${envConfig.AI_TESTER_CONFIG_PATH}`)
}

const temperature = z.number().min(0).max(1).default(DEFAULT_TEMPERATURE)
const requiredTags = z.array(z.string()).default([])
const prohibitedTags = z.array(z.string()).default(DEFAULT_PROHIBITED_TAGS)
const models = z.array(
	z.object({
		provider: z.string(),
		model: z.string(),

		/** Tags to include in this session for this model only (not provided means no restrictions) */
		requiredTags: requiredTags.optional(),

		/** Tags to exclude from this session for this model only (not provided means no restrictions) */
		prohibitedTags: prohibitedTags.optional(),

		/** Temperature to apply to this model for this session only */
		temperature: temperature.optional(),
	})
)

const analysisQuery = z.object({
	/** Description of the query */
	description: z.string(),

	/** Currency to use for the stats */
	currency: z.string().min(3).max(3).toUpperCase(),

	/** Test tags to be included in the stats (in addition to requiredTags2) */
	requiredTags1: requiredTags.optional(),

	/** Test tags to be included in the stats (in addition to requiredTags1) */
	requiredTags2: requiredTags.optional(),

	/** Test tags to be excluded from the stats */
	prohibitedTags: prohibitedTags.optional(),

	/** Candidate models to include in the stats */
	candidates: models.optional(),

	/** Evaluators to include in the stats */
	evaluators: models.optional(),

	/** Include only candidates tested at this temperature */
	candidatesTemperature: temperature.optional(),

	/** Include only evaluators using this temperature */
	evaluatorsTemperature: temperature.optional(),
})

export type AnalysisQuery = z.infer<typeof analysisQuery>

export const testsConfig = z
	.object({
		/** Models to test */
		candidates: models,

		/**
		 * Default temperature to apply to all models being tested
		 * Note: the tests will be re-run for each different temperature
		 */
		candidatesTemperature: temperature,

		/** Number of responses generated per test */
		attempts: z.number().min(1).default(DEFAULT_ATTEMPTS),

		/** Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags2) */
		requiredTags1: requiredTags,

		/** Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags1) */
		requiredTags2: requiredTags,

		/** Test tags to exclude from this run (the test runs if it does not match any of the tags) */
		prohibitedTags: prohibitedTags,

		/**
		 * Models to use to evaluate the generated responses
		 * Note: if multiple models could be used for a given evaluation, the ones highest in this list are used
		 */
		evaluators: models,

		/**
		 * Default temperature to apply to all evaluators
		 * Note: the tests will be re-run for each different temperature
		 */
		evaluatorsTemperature: temperature,

		/** Total number of evaluations per response per evaluator */
		evaluationsPerEvaluator: z.number().min(1).default(DEFAULT_EVALUATIONS),

		/** Preset queries for analysis of the test DB */
		analysisQueries: z.array(analysisQuery).optional(),
	})
	.parse(yaml.parse(fs.readFileSync(envConfig.AI_TESTER_CONFIG_PATH, 'utf-8')))
