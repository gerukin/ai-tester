import {} from 'ai';
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';
const providerModelRules = {
    'ollama.chat': [
        {
            matchRegex: /^deepseek-r1.*/, // ex: deepseek-r1:14b-qwen-distill-q4_K_M
            middlewares: [extractReasoningMiddleware({ tagName: 'think' })],
        },
    ],
};
/**
 * Wrap the model with the necessary middlewares, if any
 * @param model The model to optionally wrap
 * @returns Wrapped model with applied middlewares, or the original model if no middlewares are needed
 */
export const wrapModel = (model) => {
    const providerRules = providerModelRules[model.provider] ?? [];
    for (const rule of providerRules) {
        if (rule.matchRegex.test(model.modelId)) {
            return wrapLanguageModel({ model, middleware: rule.middlewares });
        }
    }
    return model;
};
