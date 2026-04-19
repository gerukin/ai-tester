import fs from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

import { envConfig } from './environment.js'
import { listAllYamlFiles } from '../utils/files.js'
import { stableJsonStringify } from '../utils/json.js'

const ProviderTypeSchema = z.enum([
	'ollama',
	'openai',
	'vertex',
	'vertex-anthropic',
	'perplexity',
	'openai-compatible',
])

const BaseProviderDefinitionSchema = z.object({
	code: z.string(),
	name: z.string(),
	type: ProviderTypeSchema,
})

const OpenAICompatibleProviderDefinitionSchema = BaseProviderDefinitionSchema.extend({
	type: z.literal('openai-compatible'),
	baseURL: z.string().url(),
	apiKeyEnvVar: z.string().min(1),
	supportsStructuredOutputs: z.boolean().default(false),
})

const BasicProviderDefinitionSchema = BaseProviderDefinitionSchema.extend({
	type: z.enum(['ollama', 'openai', 'vertex', 'vertex-anthropic', 'perplexity']),
})

export const ProviderDefinitionSchema = z.union([
	BasicProviderDefinitionSchema,
	OpenAICompatibleProviderDefinitionSchema,
])
export type ProviderDefinition = z.infer<typeof ProviderDefinitionSchema>

export const CostDefinitionSchema = z.object({
	costPerCall: z.number().default(0),
	costPerPromptToken: z.number().default(0),
	costPerCompletionToken: z.number().default(0),
	costPerHour: z.number().default(0),
	currency: z.string().min(3).max(3).toUpperCase(),
	validFrom: z.string(),
})
export type CostDefinition = z.infer<typeof CostDefinitionSchema>

const InputCapabilitiesSchema = z.object({
	text: z.boolean().default(false),
	image: z.boolean().default(false),
	file: z.boolean().default(false),
	pdf: z.boolean().default(false),
})

const OutputCapabilitiesSchema = z.object({
	text: z.boolean().default(false),
	structured: z.boolean().default(false),
	tools: z.boolean().default(false),
	reasoning: z.boolean().default(false),
})

const ModelCapabilitiesSchema = z.object({
	input: InputCapabilitiesSchema.default({}),
	output: OutputCapabilitiesSchema.default({}),
})
export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema)])
)

const ThinkingConfigSchema = z
	.object({
		enabled: z.boolean().optional(),
		effort: z.enum(['low', 'medium', 'high']).optional(),
		budgetTokens: z.number().int().positive().optional(),
		includeThoughts: z.boolean().optional(),
		extractionTagName: z.string().min(1).optional(),
	})
	.optional()
export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>

const RuntimeOptionsOverrideSchema = z.object({
	providerOptions: z.record(JsonValueSchema).optional(),
	thinking: ThinkingConfigSchema,
})
export type RuntimeOptionsOverride = z.infer<typeof RuntimeOptionsOverrideSchema>

const VERSIONED_MODEL_PROPERTY_PREFIXES = [
	'extraIdentifier',
	'providerOptions',
	'thinking',
	'candidateOverrides',
	'evaluatorOverrides',
] as const

export const ModelDefinitionSchema = z
	.object({
		id: z.string().min(1).optional(),
		code: z.string(),
		provider: z.string(),
		providerModelCode: z.string(),
		extraIdentifier: z.preprocess(
			value => {
				if (typeof value !== 'string') return value
				const normalized = value.trim()
				return normalized === '' ? undefined : normalized
			},
			z.string().optional()
		),
		active: z.boolean().default(true),
		providerOptions: z.record(JsonValueSchema).default({}),
		thinking: ThinkingConfigSchema,
		capabilities: ModelCapabilitiesSchema.optional(),
		candidateOverrides: RuntimeOptionsOverrideSchema.optional(),
		evaluatorOverrides: RuntimeOptionsOverrideSchema.optional(),
		uniqueProperties: z.array(z.string().min(1)).default([]),
		costs: z
			.array(CostDefinitionSchema)
			.default([])
			.superRefine((costs, ctx) => {
				const seen = new Set<string>()
				for (const cost of costs) {
					if (Number.isNaN(new Date(cost.validFrom).valueOf())) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: `Invalid validFrom date: ${cost.validFrom}`,
						})
					}

					if (seen.has(cost.validFrom)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: `Duplicate cost entry for validFrom ${cost.validFrom}`,
						})
					}
					seen.add(cost.validFrom)
				}
			}),
	})
	.transform(model => ({
		...model,
		id: model.id ?? `${model.provider}/${model.providerModelCode}`,
	}))
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>
export type ModelRole = 'candidate' | 'evaluator'

export type FileBackedModelRegistry = {
	providers: ProviderDefinition[]
	providersByCode: Map<string, ProviderDefinition>
	models: ModelDefinition[]
	activeModels: ModelDefinition[]
	modelsById: Map<string, ModelDefinition>
	modelsByRuntimeIdentity: Map<string, ModelDefinition>
}

const getYamlFilesOrThrow = (basePath: string, label: string) => {
	if (!fs.existsSync(basePath)) {
		throw new Error(`${label} directory not found: ${basePath}`)
	}
	return listAllYamlFiles(basePath)
}

const readYamlFile = <T>(filePath: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T => {
	const content = fs.readFileSync(filePath, 'utf-8')
	return schema.parse(parse(content))
}

const getModelReferenceKey = (model: Pick<ModelDefinition, 'provider' | 'providerModelCode'>) =>
	`${model.provider}:${model.providerModelCode}`

export const getModelRuntimeOptions = (model: Pick<ModelDefinition, 'providerOptions' | 'thinking'>) => ({
	providerOptions: model.providerOptions,
	thinking: model.thinking ?? null,
})

export const getEffectiveModelRuntimeOptions = (
	model: Pick<ModelDefinition, 'providerOptions' | 'thinking' | 'candidateOverrides' | 'evaluatorOverrides'>,
	type: ModelRole
) => {
	const overrides = type === 'candidate' ? model.candidateOverrides : model.evaluatorOverrides
	return {
		providerOptions: {
			...(model.providerOptions ?? {}),
			...(overrides?.providerOptions ?? {}),
		},
		thinking:
			model.thinking !== undefined || overrides?.thinking !== undefined
				? {
						...(model.thinking ?? {}),
						...(overrides?.thinking ?? {}),
					}
				: undefined,
	}
}

export const getModelRuntimeOptionsJson = (
	model: Pick<ModelDefinition, 'providerOptions' | 'thinking' | 'candidateOverrides' | 'evaluatorOverrides'>,
	role: ModelRole
) => {
	const options = getEffectiveModelRuntimeOptions(model, role)
	return stableJsonStringify({
		providerOptions: options.providerOptions,
		thinking: options.thinking ?? null,
	})
}

export const getModelRuntimeIdentityKeyFromParts = ({
	provider,
	providerModelCode,
	extraIdentifier,
	runtimeOptionsJson,
}: {
	provider: string
	providerModelCode: string
	extraIdentifier?: string | null
	runtimeOptionsJson: string
}) => `${provider}:${providerModelCode}:${extraIdentifier ?? ''}:${runtimeOptionsJson}`

export const getModelRuntimeIdentityKey = (
	model: Pick<
		ModelDefinition,
		| 'provider'
		| 'providerModelCode'
		| 'extraIdentifier'
		| 'providerOptions'
		| 'thinking'
		| 'candidateOverrides'
		| 'evaluatorOverrides'
	>,
	role: ModelRole
) =>
	getModelRuntimeIdentityKeyFromParts({
		provider: model.provider,
		providerModelCode: model.providerModelCode,
		extraIdentifier: model.extraIdentifier,
		runtimeOptionsJson: getModelRuntimeOptionsJson(model, role),
	})

export const getModelRuntimeIdentityKeys = (
	model: Pick<
		ModelDefinition,
		| 'provider'
		| 'providerModelCode'
		| 'extraIdentifier'
		| 'providerOptions'
		| 'thinking'
		| 'candidateOverrides'
		| 'evaluatorOverrides'
	>
) => Array.from(new Set((['candidate', 'evaluator'] as const).map(role => getModelRuntimeIdentityKey(model, role))))

export const getModelRuntimeIdentities = (
	model: Pick<
		ModelDefinition,
		| 'provider'
		| 'providerModelCode'
		| 'extraIdentifier'
		| 'providerOptions'
		| 'thinking'
		| 'candidateOverrides'
		| 'evaluatorOverrides'
	>
) => {
	const identities = new Map<string, { key: string; runtimeOptionsJson: string }>()
	for (const role of ['candidate', 'evaluator'] as const) {
		const runtimeOptionsJson = getModelRuntimeOptionsJson(model, role)
		const key = getModelRuntimeIdentityKeyFromParts({
			provider: model.provider,
			providerModelCode: model.providerModelCode,
			extraIdentifier: model.extraIdentifier,
			runtimeOptionsJson,
		})
		identities.set(key, { key, runtimeOptionsJson })
	}
	return Array.from(identities.values())
}

const getModelPropertyValue = (model: ModelDefinition, propertyPath: string) => {
	const pathParts = propertyPath.split('.')
	let value: unknown = model

	for (const pathPart of pathParts) {
		if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, pathPart)) {
			return undefined
		}
		value = (value as Record<string, unknown>)[pathPart]
	}

	return value
}

const validateUniqueProperties = (model: ModelDefinition) => {
	for (const propertyPath of model.uniqueProperties) {
		if (!VERSIONED_MODEL_PROPERTY_PREFIXES.some(prefix => propertyPath === prefix || propertyPath.startsWith(`${prefix}.`))) {
			throw new Error(
				`Model ${model.id} declares unsupported uniqueProperties path ${propertyPath}. Unique properties must reference versioned runtime settings: ${VERSIONED_MODEL_PROPERTY_PREFIXES.join(', ')}.`
			)
		}
		if (getModelPropertyValue(model, propertyPath) === undefined) {
			throw new Error(`Model ${model.id} declares uniqueProperties path ${propertyPath}, but that value is not set.`)
		}
	}
}

const getUniquePropertiesKey = (model: ModelDefinition) =>
	stableJsonStringify(
		Object.fromEntries(model.uniqueProperties.map(propertyPath => [propertyPath, getModelPropertyValue(model, propertyPath)]))
	)

const getActiveModels = (models: ModelDefinition[]) => {
	const groupedModels = new Map<string, ModelDefinition[]>()
	const activeModels: ModelDefinition[] = []

	for (const model of models) {
		if (!model.active) continue
		const key = getModelReferenceKey(model)
		groupedModels.set(key, [...(groupedModels.get(key) ?? []), model])
		activeModels.push(model)
	}

	for (const [reference, variants] of groupedModels) {
		if (variants.length === 1) {
			continue
		}

		const variantsWithoutUniqueProperties = variants.filter(model => model.uniqueProperties.length === 0)
		if (variantsWithoutUniqueProperties.length > 0) {
			throw new Error(
				`Active model variants for ${reference} must declare uniqueProperties: ${variantsWithoutUniqueProperties.map(model => model.id).join(', ')}.`
			)
		}

		const uniquePropertyKeys = new Set<string>()
		for (const variant of variants) {
			const key = getUniquePropertiesKey(variant)
			if (uniquePropertyKeys.has(key)) {
				throw new Error(
					`Active model variants for ${reference} do not have distinct uniqueProperties values: ${variants.map(model => model.id).join(', ')}.`
				)
			}
			uniquePropertyKeys.add(key)
		}
	}

	return activeModels
}

export const loadProviderDefinitions = (): ProviderDefinition[] => {
	const providers = getYamlFilesOrThrow(envConfig.AI_TESTER_PROVIDERS_DIR, 'Provider registry').map(file =>
		readYamlFile(file, ProviderDefinitionSchema)
	)
	const seen = new Set<string>()

	for (const provider of providers) {
		if (seen.has(provider.code)) {
			throw new Error(`Duplicate provider code found in YAML files: ${provider.code}`)
		}
		seen.add(provider.code)
	}

	return providers
}

export const loadModelDefinitions = (providersByCode?: Map<string, ProviderDefinition>): ModelDefinition[] => {
	const providerMap = providersByCode ?? new Map(loadProviderDefinitions().map(provider => [provider.code, provider]))
	const models: ModelDefinition[] = getYamlFilesOrThrow(envConfig.AI_TESTER_MODELS_DIR, 'Model registry').map(file =>
		readYamlFile(file, ModelDefinitionSchema)
	)
	const seenRuntimeIdentities = new Set<string>()
	const seenIds = new Set<string>()

	for (const model of models) {
		if (!providerMap.has(model.provider)) {
			throw new Error(
				`Model ${model.code} references missing provider ${model.provider}. Create the provider YAML file first.`
			)
		}

		if (model.active) {
			if (seenIds.has(model.id)) {
				throw new Error(`Duplicate active model id found in YAML files: ${model.id}`)
			}
			seenIds.add(model.id)
		}
		validateUniqueProperties(model)

		for (const key of getModelRuntimeIdentityKeys(model)) {
			if (seenRuntimeIdentities.has(key)) {
				throw new Error(
					`Duplicate runtime model identity found in YAML files: ${key}. Each provider/providerModelCode/extraIdentifier/runtime-options combination must map to exactly one YAML entry.`
				)
			}
			seenRuntimeIdentities.add(key)
		}
	}

	return models
}

export const loadFileBackedModelRegistry = (): FileBackedModelRegistry => {
	const providers = loadProviderDefinitions()
	const providersByCode = new Map(providers.map(provider => [provider.code, provider]))
	const models = loadModelDefinitions(providersByCode)
	const activeModels = getActiveModels(models)
	const modelsById = new Map(activeModels.map(model => [model.id, model]))
	const modelsByRuntimeIdentity = new Map(
		activeModels.flatMap(model => getModelRuntimeIdentityKeys(model).map(key => [key, model] as const))
	)

	return {
		providers,
		providersByCode,
		models,
		activeModels,
		modelsById,
		modelsByRuntimeIdentity,
	}
}

let cachedRegistry: FileBackedModelRegistry | undefined

export const getFileBackedModelRegistry = () => {
	cachedRegistry ??= loadFileBackedModelRegistry()
	return cachedRegistry
}

export const clearFileBackedModelRegistryCache = () => {
	cachedRegistry = undefined
}

const warnedContexts = new Set<string>()

export const filterConfiguredModels = <T extends { id: string }>(
	models: T[],
	context: string,
	registry: FileBackedModelRegistry = getFileBackedModelRegistry()
) => {
	const availableModels: T[] = []
	const missingModels: T[] = []

	for (const model of models) {
		if (registry.modelsById.has(model.id)) {
			availableModels.push(model)
		} else {
			missingModels.push(model)
		}
	}

	if (missingModels.length > 0 && !warnedContexts.has(context)) {
		warnedContexts.add(context)
		console.warn(`Skipping unavailable models in ${context}: ${missingModels.map(model => model.id).join(', ')}`)
	}

	return {
		availableModels,
		missingModels,
	}
}
