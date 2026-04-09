import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { addProviderSpecificProps } from './middlewares/add-provider-specific-props.js';
import { getEffectiveModelRuntimeOptions } from '../../config/model-registry.js';
const getProviderOptionsNamespace = (providerId) => {
    if (providerId.startsWith('google.vertex.'))
        return 'vertex';
    if (providerId.includes('.anthropic.'))
        return 'anthropic';
    return providerId.split('.')[0]?.trim();
};
const buildPerModelMiddlewares = (modelConfig, providerMetadataKey, supportsReasoningExtraction, type) => {
    const middlewares = [];
    const { providerOptions, thinking } = getEffectiveModelRuntimeOptions(modelConfig, type);
    if (supportsReasoningExtraction) {
        if (thinking !== undefined && thinking.enabled !== false) {
            middlewares.push(extractReasoningMiddleware({ tagName: thinking?.extractionTagName ?? 'think' }));
        }
    }
    if (!providerMetadataKey)
        return middlewares;
    const props = { ...providerOptions };
    switch (providerMetadataKey) {
        case 'vertex': {
            if (thinking !== undefined && (thinking.budgetTokens !== undefined || thinking.includeThoughts !== undefined)) {
                props['thinkingConfig'] = {
                    ...(thinking.includeThoughts !== undefined ? { includeThoughts: thinking.includeThoughts } : {}),
                    ...(thinking.budgetTokens !== undefined ? { thinkingBudget: thinking.budgetTokens } : {}),
                };
            }
            break;
        }
        case 'anthropic': {
            if (thinking?.enabled === false) {
                props['thinking'] = { type: 'disabled' };
            }
            else if (thinking?.enabled === true) {
                props['thinking'] = {
                    type: 'enabled',
                    ...(thinking.budgetTokens !== undefined ? { budgetTokens: thinking.budgetTokens } : {}),
                };
            }
            break;
        }
        default: {
            if (thinking?.effort !== undefined) {
                props['reasoningEffort'] = thinking.effort;
            }
            break;
        }
    }
    if (Object.keys(props).length > 0) {
        middlewares.push(addProviderSpecificProps(providerMetadataKey, props));
    }
    return middlewares;
};
/**
 * Wrap the model with the necessary middlewares, if any
 * @param model The model to optionally wrap
 * @returns Wrapped model with applied middlewares, or the original model if no middlewares are needed
 */
export const wrapModel = (model, type, modelConfig) => {
    if (modelConfig === undefined)
        return model;
    if (typeof model === 'string' || model.specificationVersion !== 'v3') {
        return model;
    }
    const providerMetadataKey = getProviderOptionsNamespace(model.provider);
    const supportsReasoningExtraction = model.provider.startsWith('ollama.');
    const middlewares = buildPerModelMiddlewares(modelConfig, providerMetadataKey, supportsReasoningExtraction, type);
    if (middlewares.length > 0) {
        return wrapLanguageModel({ model, middleware: middlewares });
    }
    return model;
};
