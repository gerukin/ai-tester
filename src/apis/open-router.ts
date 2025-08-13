import path from 'path'

import { createFile, getFileInfo } from '../utils/files.js'
import { envConfig } from '../config/index.js'

const PRICING_TRANSFORMS = {
	/** Cost per input token */
	prompt: (value: string) => Number((Number(value) * 1_000_000).toFixed(3)),

	/** Cost per output token */
	completion: (value: string) => Number((Number(value) * 1_000_000).toFixed(3)),

	/** Cost per API request */
	request: (value: string) => Number(Number(value).toFixed(3)),

	/** Cost per image input */
	image: (value: string) => Number(Number(value).toFixed(3)),

	// `audio` exists but is not documented

	/** Cost per web search operation */
	web_search: (value: string) => Number(Number(value).toFixed(3)),

	/** Cost for internal reasoning tokens */
	internal_reasoning: (value: string) => Number((Number(value) * 1_000_000).toFixed(3)),

	/** Cost per cached input token read */
	input_cache_read: (value: string) => Number((Number(value) * 1_000_000).toFixed(3)),

	/** Cost per cached input token write */
	input_cache_write: (value: string) => Number((Number(value) * 1_000_000).toFixed(3)),

	default: (value: string) => Number((Number(value) * 1_000_000).toFixed(3)),
} as const

const CAPABILITIES_TO_ADD_FROM_SUPPORTED_PARAMS = ['structured_outputs', 'tools', 'reasoning']

const NAME_TRANSFORMS = [
	(value: string) => value.replace(/Google/gi, 'GGL'),
	(value: string) => value.replace(/Anthropic/gi, 'ANTH'),
	(value: string) => value.replace(/Agentica/gi, 'AGTC'),
	(value: string) => value.replace(/OpenAI/gi, 'OAI'),
	(value: string) => value.replace(/Meta/gi, 'META'),
	(value: string) => value.replace(/Microsoft/gi, 'MSFT'),
	(value: string) => value.replace(/Mistral/gi, 'MSTL'),
	(value: string) => value.replace(/Perplexity/gi, 'PPX'),
	(value: string) => value.replace(/Cohere/gi, 'COHR'),
	(value: string) => value.replace(/Stability AI/gi, 'STBL'),
	(value: string) => value.replace(/Baidu/gi, 'BDU'),
	(value: string) => value.replace(/Alibaba/gi, 'ALI'),
	(value: string) => value.replace(/DeepMind/gi, 'DMND'),
	(value: string) => value.replace(/^DeepSeek/gi, 'DeepS'),
	(value: string) => value.replace(/Hugging Face/gi, 'HF'),
	// Z.AI and xAI are already short enough, do not transform

	// Other abbreviations
	(value: string) => value.replace(/thinking/gi, 'think.'),
	(value: string) => value.replace(/self-moderated/gi, 'self-mod.'),
	(value: string) => value.replace(/preview/gi, 'prev.'),
	(value: string) => value.replace(/experimental/gi, 'exp.'),
	(value: string) => value.replace(/free/gi, '🤑'),
]

const PRICING_KEY_TRANSFORMS = [
	(value: string) => value.replace(/prompt/gi, 'in'),
	(value: string) => value.replace(/completion/gi, 'out'),
	(value: string) => value.replace(/request/gi, 'req'),
	(value: string) => value.replace(/image/gi, 'img'),
	(value: string) => value.replace(/audio/gi, 'aud'),
	(value: string) => value.replace(/web_search/gi, 'web'),
	(value: string) => value.replace(/internal_reasoning/gi, 'reas'),
	(value: string) => value.replace(/input_cache_read/gi, 'cch_r'),
	(value: string) => value.replace(/input_cache_write/gi, 'cch_w'),
]

const CAPABILITIES_KEY_TRANSFORMS = [
	(value: string) => value.replace(/text/gi, 'txt'),
	(value: string) => value.replace(/file/gi, 'fil'),
	(value: string) => value.replace(/image/gi, 'img'),
	(value: string) => value.replace(/video/gi, 'vid'),
	(value: string) => value.replace(/audio/gi, 'aud'),
	(value: string) => value.replace(/structured_outputs/gi, 'json'),
	(value: string) => value.replace(/tools/gi, '🛠️'),
	(value: string) => value.replace(/reasoning/gi, '🧠'),
]

// Type for OpenRouter model
export interface OpenRouterModel {
	id: string
	canonical_slug: string
	hugging_face_id: string
	name: string
	created: number
	description: string
	context_length: number
	architecture: {
		input_modalities: string[]
		output_modalities: string[]
	}
	pricing: Record<string, string>
	top_provider: Record<string, any>
	per_request_limits: any
	supported_parameters: string[]

	// Enhanced description for the model - built dynamically
	_enhanced_description: string

	// Model capabilities - built dynamically
	_capabilities: {
		in: string[]
		out: string[]
		other: string[]
	}
}

let hasFetched = false

const getModalityHeader = (raw_modality: string, type: 'input' | 'output' | 'other', transform: boolean = false) => {
	if (transform) raw_modality = CAPABILITIES_KEY_TRANSFORMS.reduce((acc, transform) => transform(acc), raw_modality)
	return type === 'input' ? `⬆️ ${raw_modality}` : type === 'output' ? `⬇️ ${raw_modality}` : raw_modality
}

const getEnhancedDescription = (model: OpenRouterModel): string => {
	const capabilities = [
		...model._capabilities.in.map(capability => getModalityHeader(capability, 'input')),
		...model._capabilities.out.map(capability => getModalityHeader(capability, 'output')),
		...model._capabilities.other.map(capability => getModalityHeader(capability, 'other')),
	].join(', ')
	const pricing = model.pricing
		? Object.entries(model.pricing)
				.map(([key, value]) => {
					const transform =
						key in PRICING_TRANSFORMS
							? // @ts-ignore
							  PRICING_TRANSFORMS[key]
							: PRICING_TRANSFORMS.default
					return Number(value) > 0 ? `${key}: ${transform(value)}` : undefined
				})
				.filter(Boolean)
				.join(', ')
		: 'Unknown'
	return `💪 ${capabilities}\n💵 ${pricing}\n${model.description}`
}

const getCapabilities = (model: OpenRouterModel) => {
	return {
		in: model.architecture?.['input_modalities']?.map(modality => modality) || [],
		out: model.architecture?.['output_modalities']?.map(modality => modality) || [],
		other: model.supported_parameters.filter(param => CAPABILITIES_TO_ADD_FROM_SUPPORTED_PARAMS.includes(param)),
	}
}

/**
 * Fetches OpenRouter models from API (once per session), caches to logs, and returns parsed array.
 */
export const getOpenRouterModels = async (): Promise<OpenRouterModel[]> => {
	const filePath = path.join(envConfig.AI_TESTER_LOGS_DIR, 'open-router-models.json')
	let data: any

	if (!hasFetched) {
		try {
			const res = await fetch('https://openrouter.ai/api/v1/models')
			if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
			data = await res.json()
			createFile(filePath, JSON.stringify(data, null, 2), 'utf8')
			hasFetched = true
		} catch (err) {
			// Try to read from file if fetch fails
			try {
				const { content } = getFileInfo(envConfig.AI_TESTER_LOGS_DIR, 'open-router-models.json', 'utf-8')
				data = JSON.parse(content as string)
			} catch (fileErr) {
				throw new Error('Could not fetch or read cached OpenRouter models')
			}
		}
	} else {
		// Already fetched, read from file
		const { content } = getFileInfo(envConfig.AI_TESTER_LOGS_DIR, 'open-router-models.json', 'utf-8')
		data = JSON.parse(content as string)
	}

	if (!data?.data || !Array.isArray(data.data)) throw new Error('Invalid OpenRouter models data')
	return data.data.map((model: OpenRouterModel) => {
		const newModel = {
			...model,
			_capabilities: getCapabilities(model),
		}
		newModel._enhanced_description = getEnhancedDescription(newModel)
		return newModel
	}) as OpenRouterModel[]
}

/**
 * Formats OpenRouter models for display in a table or as an array of objects.
 */
export const formatOpenRouterModelsForDisplay = (models: OpenRouterModel[]) => {
	const formattedModels = []

	for (const model of models) {
		const modalityColumns: Record<string, string> = {
			...Object.fromEntries(
				model._capabilities.in.filter(c => c !== 'text').map(c => [getModalityHeader(c, 'input', true), '✅'])
			),
			...Object.fromEntries(
				model._capabilities.out.filter(c => c !== 'text').map(c => [getModalityHeader(c, 'output', true), '✅'])
			),
			...Object.fromEntries(model._capabilities.other.map(c => [getModalityHeader(c, 'other', true), '✅'])),
		}

		// Collect all pricing keys for all models
		const allPricingKeys = Array.from(new Set(models.flatMap(m => (m.pricing ? Object.keys(m.pricing) : []))))
		// Only include keys where at least one model has a non-zero price
		const nonZeroPricingKeys = allPricingKeys.filter(key =>
			models.some(m => m.pricing && m.pricing[key] && m.pricing[key] !== '0')
		)

		const pricingColumns: Record<string, number> = {}
		if (model.pricing && typeof model.pricing === 'object') {
			for (const key of nonZeroPricingKeys) {
				const transformedKey = PRICING_KEY_TRANSFORMS.reduce((acc, transform) => transform(acc), key)
				const transform =
					key in PRICING_TRANSFORMS
						? // @ts-ignore
						  PRICING_TRANSFORMS[key]
						: PRICING_TRANSFORMS.default
				if (model.pricing[key]) pricingColumns[`$${transformedKey}`] = transform(model.pricing[key])
			}
		}

		// Apply all name transforms to model.name
		let transformedName = model.name
		for (const transform of NAME_TRANSFORMS) {
			transformedName = transform(transformedName)
		}
		formattedModels.push([
			transformedName,
			{
				...pricingColumns,
				...modalityColumns,
			},
		])
	}

	return Object.fromEntries(formattedModels)
}
