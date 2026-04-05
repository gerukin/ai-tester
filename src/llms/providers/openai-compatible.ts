import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export default (provider: { name: string; baseURL: string; apiKeyEnvVar: string }) =>
	createOpenAICompatible({
		name: provider.name,
		baseURL: provider.baseURL,
		apiKey: process.env[provider.apiKeyEnvVar],
	})
