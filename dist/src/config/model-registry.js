import fs from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { envConfig } from './environment.js';
import { listAllYamlFiles } from '../utils/files.js';
import { stableJsonStringify } from '../utils/json.js';
const ProviderTypeSchema = z.enum([
    'ollama',
    'openai',
    'vertex',
    'vertex-anthropic',
    'perplexity',
    'openai-compatible',
]);
const BaseProviderDefinitionSchema = z.object({
    code: z.string(),
    name: z.string(),
    type: ProviderTypeSchema,
});
const OpenAICompatibleProviderDefinitionSchema = BaseProviderDefinitionSchema.extend({
    type: z.literal('openai-compatible'),
    baseURL: z.string().url(),
    apiKeyEnvVar: z.string().min(1),
    supportsStructuredOutputs: z.boolean().default(false),
});
const BasicProviderDefinitionSchema = BaseProviderDefinitionSchema.extend({
    type: z.enum(['ollama', 'openai', 'vertex', 'vertex-anthropic', 'perplexity']),
});
export const ProviderDefinitionSchema = z.union([
    BasicProviderDefinitionSchema,
    OpenAICompatibleProviderDefinitionSchema,
]);
export const CostDefinitionSchema = z.object({
    costPerCall: z.number().default(0),
    costPerPromptToken: z.number().default(0),
    costPerCompletionToken: z.number().default(0),
    costPerHour: z.number().default(0),
    currency: z.string().min(3).max(3).toUpperCase(),
    validFrom: z.string(),
});
const InputCapabilitiesSchema = z.object({
    text: z.boolean().default(false),
    image: z.boolean().default(false),
    file: z.boolean().default(false),
    pdf: z.boolean().default(false),
});
const OutputCapabilitiesSchema = z.object({
    text: z.boolean().default(false),
    structured: z.boolean().default(false),
    tools: z.boolean().default(false),
    reasoning: z.boolean().default(false),
});
const ModelCapabilitiesSchema = z.object({
    input: InputCapabilitiesSchema.default({}),
    output: OutputCapabilitiesSchema.default({}),
});
const JsonValueSchema = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema)]));
const ThinkingConfigSchema = z
    .object({
    enabled: z.boolean().optional(),
    effort: z.enum(['low', 'medium', 'high']).optional(),
    budgetTokens: z.number().int().positive().optional(),
    includeThoughts: z.boolean().optional(),
    extractionTagName: z.string().min(1).optional(),
})
    .optional();
const RuntimeOptionsOverrideSchema = z.object({
    providerOptions: z.record(JsonValueSchema).optional(),
    thinking: ThinkingConfigSchema,
});
export const ModelDefinitionSchema = z.object({
    code: z.string(),
    provider: z.string(),
    providerModelCode: z.string(),
    extraIdentifier: z.preprocess(value => {
        if (typeof value !== 'string')
            return value;
        const normalized = value.trim();
        return normalized === '' ? undefined : normalized;
    }, z.string().optional()),
    active: z.boolean().default(true),
    providerOptions: z.record(JsonValueSchema).default({}),
    thinking: ThinkingConfigSchema,
    capabilities: ModelCapabilitiesSchema.optional(),
    candidateOverrides: RuntimeOptionsOverrideSchema.optional(),
    evaluatorOverrides: RuntimeOptionsOverrideSchema.optional(),
    costs: z
        .array(CostDefinitionSchema)
        .default([])
        .superRefine((costs, ctx) => {
        const seen = new Set();
        for (const cost of costs) {
            if (Number.isNaN(new Date(cost.validFrom).valueOf())) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid validFrom date: ${cost.validFrom}`,
                });
            }
            if (seen.has(cost.validFrom)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Duplicate cost entry for validFrom ${cost.validFrom}`,
                });
            }
            seen.add(cost.validFrom);
        }
    }),
});
const getYamlFilesOrThrow = (basePath, label) => {
    if (!fs.existsSync(basePath)) {
        throw new Error(`${label} directory not found: ${basePath}`);
    }
    return listAllYamlFiles(basePath);
};
const readYamlFile = (filePath, schema) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    return schema.parse(parse(content));
};
const getModelReferenceKey = (model) => `${model.provider}:${model.providerModelCode}`;
export const getModelRuntimeOptions = (model) => ({
    providerOptions: model.providerOptions,
    thinking: model.thinking ?? null,
});
export const getRoleAwareModelRuntimeOptions = (model) => ({
    ...getModelRuntimeOptions(model),
    ...(model.candidateOverrides !== undefined
        ? {
            candidateOverrides: {
                providerOptions: model.candidateOverrides.providerOptions ?? {},
                thinking: model.candidateOverrides.thinking ?? null,
            },
        }
        : {}),
    ...(model.evaluatorOverrides !== undefined
        ? {
            evaluatorOverrides: {
                providerOptions: model.evaluatorOverrides.providerOptions ?? {},
                thinking: model.evaluatorOverrides.thinking ?? null,
            },
        }
        : {}),
});
export const getEffectiveModelRuntimeOptions = (model, type) => {
    const overrides = type === 'candidate' ? model.candidateOverrides : model.evaluatorOverrides;
    return {
        providerOptions: {
            ...(model.providerOptions ?? {}),
            ...(overrides?.providerOptions ?? {}),
        },
        thinking: model.thinking !== undefined || overrides?.thinking !== undefined
            ? {
                ...(model.thinking ?? {}),
                ...(overrides?.thinking ?? {}),
            }
            : undefined,
    };
};
export const getModelRuntimeOptionsJson = (model) => stableJsonStringify(getRoleAwareModelRuntimeOptions(model));
const getModelIdentityKey = (model) => `${model.provider}:${model.providerModelCode}:${model.extraIdentifier ?? ''}:${getModelRuntimeOptionsJson(model)}`;
const getActiveModels = (models) => {
    const groupedModels = new Map();
    for (const model of models) {
        if (!model.active)
            continue;
        const key = getModelReferenceKey(model);
        groupedModels.set(key, [...(groupedModels.get(key) ?? []), model]);
    }
    const activeModels = [];
    for (const [reference, variants] of groupedModels) {
        if (variants.length === 1) {
            activeModels.push(variants[0]);
            continue;
        }
        const details = variants
            .map(model => `${model.code}${model.extraIdentifier ? ` (extraIdentifier: ${model.extraIdentifier})` : ''}`)
            .join(', ');
        throw new Error(`Conflicting active model variants for ${reference}: ${details}. Set active: false on all but one YAML entry for this provider/model code combination.`);
    }
    return activeModels;
};
export const loadProviderDefinitions = () => {
    const providers = getYamlFilesOrThrow(envConfig.AI_TESTER_PROVIDERS_DIR, 'Provider registry').map(file => readYamlFile(file, ProviderDefinitionSchema));
    const seen = new Set();
    for (const provider of providers) {
        if (seen.has(provider.code)) {
            throw new Error(`Duplicate provider code found in YAML files: ${provider.code}`);
        }
        seen.add(provider.code);
    }
    return providers;
};
export const loadModelDefinitions = (providersByCode) => {
    const providerMap = providersByCode ?? new Map(loadProviderDefinitions().map(provider => [provider.code, provider]));
    const models = getYamlFilesOrThrow(envConfig.AI_TESTER_MODELS_DIR, 'Model registry').map(file => readYamlFile(file, ModelDefinitionSchema));
    const seen = new Set();
    for (const model of models) {
        if (!providerMap.has(model.provider)) {
            throw new Error(`Model ${model.code} references missing provider ${model.provider}. Create the provider YAML file first.`);
        }
        const key = getModelIdentityKey(model);
        if (seen.has(key)) {
            throw new Error(`Duplicate runtime model identity found in YAML files: ${key}. Each provider/providerModelCode/extraIdentifier combination must map to exactly one YAML entry.`);
        }
        seen.add(key);
    }
    return models;
};
export const loadFileBackedModelRegistry = () => {
    const providers = loadProviderDefinitions();
    const providersByCode = new Map(providers.map(provider => [provider.code, provider]));
    const models = loadModelDefinitions(providersByCode);
    const activeModels = getActiveModels(models);
    const modelsByReference = new Map(activeModels.map(model => [getModelReferenceKey(model), model]));
    return {
        providers,
        providersByCode,
        models,
        activeModels,
        modelsByReference,
    };
};
let cachedRegistry;
export const getFileBackedModelRegistry = () => {
    cachedRegistry ??= loadFileBackedModelRegistry();
    return cachedRegistry;
};
export const clearFileBackedModelRegistryCache = () => {
    cachedRegistry = undefined;
};
const warnedContexts = new Set();
export const filterConfiguredModels = (models, context, registry = getFileBackedModelRegistry()) => {
    const availableModels = [];
    const missingModels = [];
    for (const model of models) {
        if (registry.modelsByReference.has(`${model.provider}:${model.model}`)) {
            availableModels.push(model);
        }
        else {
            missingModels.push(model);
        }
    }
    if (missingModels.length > 0 && !warnedContexts.has(context)) {
        warnedContexts.add(context);
        console.warn(`Skipping unavailable models in ${context}: ${missingModels
            .map(model => `${model.provider}:${model.model}`)
            .join(', ')}`);
    }
    return {
        availableModels,
        missingModels,
    };
};
