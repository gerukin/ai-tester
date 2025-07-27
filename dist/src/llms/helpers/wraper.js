import {} from 'ai';
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { addProviderSpecificProps } from './middlewares/add-provider-specific-props.js';
import { MAX_TEST_REASONING_EFFORT, MAX_EVALUATION_REASONING_EFFORT, } from '../../config/index.js';
import { envConfig } from '../../config/environment.js';
const providerModelRules = {
    'ollama.chat': [
        {
            matchRegex: /.*/, // matches all models (no need to specifically exclude non thinking models)
            middlewares: [extractReasoningMiddleware({ tagName: 'think' })],
        },
    ],
    vertex: [
        {
            type: 'evaluator',
            matchRegex: /^gemini-2\.5.*/, // ex: gemini-2.5-flash
            middlewares: [
                addProviderSpecificProps('vertex', {
                    thinkingConfig: { includeThoughts: true, thinkingBudget: envConfig.MAX_EVALUATION_THINKING_TOKENS },
                }),
            ],
        },
        {
            type: 'candidate',
            matchRegex: /^gemini-2\.5.*/, // ex: gemini-2.5-flash
            middlewares: [
                addProviderSpecificProps('vertex', {
                    thinkingConfig: { includeThoughts: true, thinkingBudget: envConfig.MAX_TEST_THINKING_TOKENS },
                }),
            ],
        },
    ],
    anthropic: [
        {
            type: 'evaluator',
            matchRegex: /^claude-(3\.7|4).*/, // ex: claude-3.7 or claude-4
            middlewares: [
                addProviderSpecificProps('anthropic', {
                    thinking: { type: 'enabled', budgetTokens: envConfig.MAX_EVALUATION_THINKING_TOKENS },
                }),
            ],
        },
        {
            type: 'candidate',
            matchRegex: /^claude-(3\.7|4).*/, // ex: claude-3.7 or claude-4
            middlewares: [
                addProviderSpecificProps('anthropic', {
                    thinking: { type: 'enabled', budgetTokens: envConfig.MAX_TEST_THINKING_TOKENS },
                }),
            ],
        },
    ],
    openai: [
        {
            type: 'evaluator',
            matchRegex: /^(o3-|o4-).*/, // ex: o3 or o4-mini
            middlewares: [
                addProviderSpecificProps('openai', {
                    reasoningEffort: MAX_EVALUATION_REASONING_EFFORT,
                }),
            ],
        },
        {
            type: 'candidate',
            matchRegex: /^(o3-|o4-).*/, // ex: o3 or o4-mini
            middlewares: [
                addProviderSpecificProps('openai', {
                    reasoningEffort: MAX_TEST_REASONING_EFFORT,
                }),
            ],
        },
    ],
};
/**
 * Wrap the model with the necessary middlewares, if any
 * @param model The model to optionally wrap
 * @returns Wrapped model with applied middlewares, or the original model if no middlewares are needed
 */
export const wrapModel = (model, type) => {
    const providerRules = providerModelRules[model.provider] ?? [];
    for (const rule of providerRules) {
        if (rule.matchRegex.test(model.modelId) && (!rule.type || rule.type === type)) {
            return wrapLanguageModel({ model, middleware: rule.middlewares });
        }
    }
    return model;
};
