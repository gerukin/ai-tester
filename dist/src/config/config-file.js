import fs from 'node:fs';
import yaml from 'yaml';
import { z } from 'zod';
import { DEFAULT_TEMPERATURE, DEFAULT_ATTEMPTS, DEFAULT_PROHIBITED_TAGS, DEFAULT_EVALUATIONS } from './constants.js';
import { envConfig } from './environment.js';
import { filterConfiguredModels, getFileBackedModelRegistry } from './model-registry.js';
// if the config file is not found, we throw an error
if (!fs.existsSync(envConfig.AI_TESTER_CONFIG_PATH)) {
    throw new Error(`Config file not found at ${envConfig.AI_TESTER_CONFIG_PATH}`);
}
export const TemperatureSchema = z.number().min(0).max(1).default(DEFAULT_TEMPERATURE);
export const RequiredTagsSchema = z.array(z.string()).default([]);
export const ProhibitedTagsSchema = z.array(z.string()).default(DEFAULT_PROHIBITED_TAGS);
export const ConfiguredModelsSchema = z.array(z.object({
    id: z.string().min(1),
    /** Tags to include in this session for this model only (not provided means no restrictions) */
    requiredTags: RequiredTagsSchema.optional(),
    /** Tags to exclude from this session for this model only (not provided means no restrictions) */
    prohibitedTags: ProhibitedTagsSchema.optional(),
    /** Temperature to apply to this model for this session only */
    temperature: TemperatureSchema.optional(),
})).superRefine((models, ctx) => {
    const seen = new Set();
    for (const model of models) {
        if (seen.has(model.id)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate configured model reference: ${model.id}`,
            });
        }
        seen.add(model.id);
    }
});
export const AnalysisQuerySchema = z.object({
    /** Description of the query */
    description: z.string(),
    /** Currency to use for the stats */
    currency: z.string().min(3).max(3).toUpperCase(),
    /** Test tags to be included in the stats (in addition to requiredTags2) */
    requiredTags1: RequiredTagsSchema.optional(),
    /** Test tags to be included in the stats (in addition to requiredTags1) */
    requiredTags2: RequiredTagsSchema.optional(),
    /** Test tags to be excluded from the stats */
    prohibitedTags: ProhibitedTagsSchema.optional(),
    /** Candidate system prompt codes or version hashes to include in the stats */
    systemPrompts: z.array(z.string()).optional(),
    /** Candidate models to include in the stats */
    candidates: ConfiguredModelsSchema.optional(),
    /** Evaluators to include in the stats */
    evaluators: ConfiguredModelsSchema.optional(),
    /** Include only candidates tested at this temperature */
    candidatesTemperature: TemperatureSchema.optional(),
    /** Include only evaluators using this temperature */
    evaluatorsTemperature: TemperatureSchema.optional(),
});
export const AdHocAnalysisQuerySchema = AnalysisQuerySchema.extend({
    description: z.string().default('Ad hoc query'),
});
export const TestsConfigSchema = z.object({
    /** Models to test */
    candidates: ConfiguredModelsSchema,
    /**
     * Default temperature to apply to all models being tested
     * Note: the tests will be re-run for each different temperature
     */
    candidatesTemperature: TemperatureSchema,
    /** Number of responses generated per test */
    attempts: z.number().min(1).default(DEFAULT_ATTEMPTS),
    /** Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags2) */
    requiredTags1: RequiredTagsSchema,
    /** Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags1) */
    requiredTags2: RequiredTagsSchema,
    /** Test tags to exclude from this run (the test runs if it does not match any of the tags) */
    prohibitedTags: ProhibitedTagsSchema,
    /**
     * Models to use to evaluate the generated responses
     * Note: if multiple models could be used for a given evaluation, the ones highest in this list are used
     */
    evaluators: ConfiguredModelsSchema,
    /**
     * Default temperature to apply to all evaluators
     * Note: the tests will be re-run for each different temperature
     */
    evaluatorsTemperature: TemperatureSchema,
    /** Total number of evaluations per response per evaluator */
    evaluationsPerEvaluator: z.number().min(1).default(DEFAULT_EVALUATIONS),
    /** Preset queries for analysis of the test DB */
    analysisQueries: z
        .array(AnalysisQuerySchema)
        .superRefine((queries, ctx) => {
        const seen = new Set();
        for (const query of queries) {
            if (seen.has(query.description)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Duplicate analysis query description: ${query.description}`,
                });
            }
            seen.add(query.description);
        }
    })
        .optional(),
});
export const TestRunConfigOverridesSchema = TestsConfigSchema.pick({
    candidates: true,
    candidatesTemperature: true,
    attempts: true,
    requiredTags1: true,
    requiredTags2: true,
    prohibitedTags: true,
}).partial().strict();
export const EvaluationRunConfigOverridesSchema = TestsConfigSchema.pick({
    candidates: true,
    candidatesTemperature: true,
    requiredTags1: true,
    requiredTags2: true,
    prohibitedTags: true,
    evaluators: true,
    evaluatorsTemperature: true,
    evaluationsPerEvaluator: true,
}).partial().strict();
export const testsConfig = TestsConfigSchema
    .parse(yaml.parse(fs.readFileSync(envConfig.AI_TESTER_CONFIG_PATH, 'utf-8')));
export const mergeTestsConfigOverrides = (overrides) => TestsConfigSchema.parse({
    ...testsConfig,
    ...overrides,
});
export const resolveAnalysisQuery = (query, registry = getFileBackedModelRegistry()) => ({
    ...query,
    candidates: query.candidates
        ? filterConfiguredModels(query.candidates, `analysis query "${query.description}" candidates`, registry).availableModels
        : undefined,
    evaluators: query.evaluators
        ? filterConfiguredModels(query.evaluators, `analysis query "${query.description}" evaluators`, registry).availableModels
        : undefined,
});
export const resolveTestsConfig = (config = testsConfig, registry = getFileBackedModelRegistry()) => ({
    ...config,
    candidates: filterConfiguredModels(config.candidates, 'tests config candidates', registry).availableModels,
    evaluators: filterConfiguredModels(config.evaluators, 'tests config evaluators', registry).availableModels,
    analysisQueries: config.analysisQueries?.map(query => resolveAnalysisQuery(query, registry)),
});
void resolveTestsConfig();
