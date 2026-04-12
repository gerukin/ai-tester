import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import type { ProviderDefinition } from '../../config/model-registry.js'

export default (provider: Extract<ProviderDefinition, { type: 'openai-compatible' }>) =>
	createOpenAICompatible({
		name: provider.code,
		baseURL: provider.baseURL,
		apiKey: process.env[provider.apiKeyEnvVar],
		supportsStructuredOutputs: provider.supportsStructuredOutputs,
	})
