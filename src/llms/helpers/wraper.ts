import { type LanguageModel, type LanguageModelV1Middleware } from 'ai'
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai'

import { addProviderSpecificProps } from './middlewares/add-provider-specific-props.js'
import { getEffectiveModelRuntimeOptions, type ModelDefinition } from '../../config/model-registry.js'

type ModelType = 'candidate' | 'evaluator'

const buildPerModelMiddlewares = (
	model: LanguageModel,
	modelConfig: Pick<ModelDefinition, 'providerOptions' | 'thinking' | 'candidateOverrides' | 'evaluatorOverrides'>,
	type: ModelType
): LanguageModelV1Middleware[] => {
	const middlewares: LanguageModelV1Middleware[] = []
	const providerMetadataKey = model.provider.split('.')[0]?.trim()
	const { providerOptions, thinking } = getEffectiveModelRuntimeOptions(modelConfig, type)

	if (model.provider === 'ollama.chat') {
		if (thinking !== undefined && thinking.enabled !== false) {
			middlewares.push(extractReasoningMiddleware({ tagName: thinking?.extractionTagName ?? 'think' }))
		}
	}

	if (!providerMetadataKey) return middlewares

	const props: Record<string, unknown> = { ...providerOptions }

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
	modelConfig?: Pick<ModelDefinition, 'providerOptions' | 'thinking' | 'candidateOverrides' | 'evaluatorOverrides'>
) => {
	if (modelConfig === undefined) return model

	const middlewares = buildPerModelMiddlewares(model, modelConfig, type)
	if (middlewares.length > 0) {
		return wrapLanguageModel({ model, middleware: middlewares })
	}
	return model
}
