import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import type { ProviderDefinition } from '../../config/model-registry.js'

const appendProviderToolsToRequestBody = (args: Record<string, any>) => {
	const { providerTools, ...body } = args
	if (!Array.isArray(providerTools) || providerTools.length === 0) return body

	return {
		...body,
		tools: [
			...(Array.isArray(body['tools']) ? body['tools'] : []),
			...providerTools,
		],
	}
}

export default (provider: Extract<ProviderDefinition, { type: 'openai-compatible' }>) =>
	createOpenAICompatible({
		name: provider.code,
		baseURL: provider.baseURL,
		apiKey: process.env[provider.apiKeyEnvVar],
		supportsStructuredOutputs: provider.supportsStructuredOutputs,
		transformRequestBody: appendProviderToolsToRequestBody,
	})
