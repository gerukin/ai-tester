import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export default (provider: { code: string; baseURL: string; apiKeyEnvVar: string }) =>
	createOpenAICompatible({
		name: provider.code,
		baseURL: provider.baseURL,
		apiKey: process.env[provider.apiKeyEnvVar],
	})
