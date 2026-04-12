import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
export default (provider) => createOpenAICompatible({
    name: provider.code,
    baseURL: provider.baseURL,
    apiKey: process.env[provider.apiKeyEnvVar],
    supportsStructuredOutputs: provider.supportsStructuredOutputs,
});
