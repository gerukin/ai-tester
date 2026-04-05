import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
export default (provider) => createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseURL,
    apiKey: process.env[provider.apiKeyEnvVar],
});
