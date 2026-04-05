import fs from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

import { envConfig } from './environment.js'
import { listAllYamlFiles } from '../utils/files.js'

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

export const ModelDefinitionSchema = z.object({
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
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>

export type FileBackedModelRegistry = {
	providers: ProviderDefinition[]
	providersByCode: Map<string, ProviderDefinition>
	models: ModelDefinition[]
	activeModels: ModelDefinition[]
	modelsByReference: Map<string, ModelDefinition>
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

const getModelIdentityKey = (model: Pick<ModelDefinition, 'provider' | 'providerModelCode' | 'extraIdentifier'>) =>
	`${model.provider}:${model.providerModelCode}:${model.extraIdentifier ?? ''}`

const getActiveModels = (models: ModelDefinition[]) => {
	const groupedModels = new Map<string, ModelDefinition[]>()

	for (const model of models) {
		if (!model.active) continue
		const key = getModelReferenceKey(model)
		groupedModels.set(key, [...(groupedModels.get(key) ?? []), model])
	}

	const activeModels: ModelDefinition[] = []
	for (const [reference, variants] of groupedModels) {
		if (variants.length === 1) {
			activeModels.push(variants[0])
			continue
		}

		const details = variants
			.map(model => `${model.code}${model.extraIdentifier ? ` (extraIdentifier: ${model.extraIdentifier})` : ''}`)
			.join(', ')
		throw new Error(
			`Conflicting active model variants for ${reference}: ${details}. Set active: false on all but one YAML entry for this provider/model code combination.`
		)
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
	const seen = new Set<string>()

	for (const model of models) {
		if (!providerMap.has(model.provider)) {
			throw new Error(
				`Model ${model.code} references missing provider ${model.provider}. Create the provider YAML file first.`
			)
		}

		const key = getModelIdentityKey(model)
		if (seen.has(key)) {
			throw new Error(
				`Duplicate runtime model identity found in YAML files: ${key}. Each provider/providerModelCode/extraIdentifier combination must map to exactly one YAML entry.`
			)
		}
		seen.add(key)
	}

	return models
}

export const loadFileBackedModelRegistry = (): FileBackedModelRegistry => {
	const providers = loadProviderDefinitions()
	const providersByCode = new Map(providers.map(provider => [provider.code, provider]))
	const models = loadModelDefinitions(providersByCode)
	const activeModels = getActiveModels(models)
	const modelsByReference = new Map(activeModels.map(model => [getModelReferenceKey(model), model]))

	return {
		providers,
		providersByCode,
		models,
		activeModels,
		modelsByReference,
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

export const filterConfiguredModels = <T extends { provider: string; model: string }>(
	models: T[],
	context: string,
	registry: FileBackedModelRegistry = getFileBackedModelRegistry()
) => {
	const availableModels: T[] = []
	const missingModels: T[] = []

	for (const model of models) {
		if (registry.modelsByReference.has(`${model.provider}:${model.model}`)) {
			availableModels.push(model)
		} else {
			missingModels.push(model)
		}
	}

	if (missingModels.length > 0 && !warnedContexts.has(context)) {
		warnedContexts.add(context)
		console.warn(
			`Skipping unavailable models in ${context}: ${missingModels
				.map(model => `${model.provider}:${model.model}`)
				.join(', ')}`
		)
	}

	return {
		availableModels,
		missingModels,
	}
}
