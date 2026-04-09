import type { JSONValue, LanguageModel, LanguageModelMiddleware } from 'ai'
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai'

import { addProviderSpecificProps } from './middlewares/add-provider-specific-props.js'
import { getEffectiveModelRuntimeOptions, type ModelDefinition } from '../../config/model-registry.js'

type ModelType = 'candidate' | 'evaluator'

const getProviderOptionsNamespace = (providerId: string) => {
	if (providerId.startsWith('google.vertex.')) return 'vertex'
	if (providerId.includes('.anthropic.')) return 'anthropic'
	return providerId.split('.')[0]?.trim()
}

const buildPerModelMiddlewares = (
	modelConfig: Pick<ModelDefinition, 'providerOptions' | 'thinking' | 'candidateOverrides' | 'evaluatorOverrides'>,
	providerMetadataKey: string | undefined,
	supportsReasoningExtraction: boolean,
	type: ModelType
): LanguageModelMiddleware[] => {
	const middlewares: LanguageModelMiddleware[] = []
	const { providerOptions, thinking } = getEffectiveModelRuntimeOptions(modelConfig, type)

	if (supportsReasoningExtraction) {
		if (thinking !== undefined && thinking.enabled !== false) {
			middlewares.push(extractReasoningMiddleware({ tagName: thinking?.extractionTagName ?? 'think' }))
		}
	}

	if (!providerMetadataKey) return middlewares

	const props: Record<string, JSONValue> = { ...(providerOptions as Record<string, JSONValue>) }

	switch (providerMetadataKey) {
		case 'vertex': {
			if (thinking !== undefined && (thinking.budgetTokens !== undefined || thinking.includeThoughts !== undefined)) {
				props['thinkingConfig'] = {
					...(thinking.includeThoughts !== undefined ? { includeThoughts: thinking.includeThoughts } : {}),
					...(thinking.budgetTokens !== undefined ? { thinkingBudget: thinking.budgetTokens } : {}),
				}
			}
			break
		}
		case 'anthropic': {
			if (thinking?.enabled === false) {
				props['thinking'] = { type: 'disabled' }
			} else if (thinking?.enabled === true) {
				props['thinking'] = {
					type: 'enabled',
					...(thinking.budgetTokens !== undefined ? { budgetTokens: thinking.budgetTokens } : {}),
				}
			}
			break
		}
		default: {
			if (thinking?.effort !== undefined) {
				props['reasoningEffort'] = thinking.effort
			}
			break
		}
	}

	if (Object.keys(props).length > 0) {
		middlewares.push(addProviderSpecificProps(providerMetadataKey, props))
	}

	return middlewares
}

/**
 * Wrap the model with the necessary middlewares, if any
 * @param model The model to optionally wrap
 * @returns Wrapped model with applied middlewares, or the original model if no middlewares are needed
 */
export const wrapModel = (
	model: LanguageModel,
	type: ModelType,
	modelConfig?: Pick<
		ModelDefinition,
		'provider' | 'providerOptions' | 'thinking' | 'candidateOverrides' | 'evaluatorOverrides'
	>
) => {
	if (modelConfig === undefined) return model

	if (typeof model === 'string' || model.specificationVersion !== 'v3') {
		return model
	}

	const providerMetadataKey = getProviderOptionsNamespace(model.provider)
	const supportsReasoningExtraction = model.provider.startsWith('ollama.')
	const middlewares = buildPerModelMiddlewares(modelConfig, providerMetadataKey, supportsReasoningExtraction, type)
	if (middlewares.length > 0) {
		return wrapLanguageModel({ model, middleware: middlewares })
	}
	return model
}
