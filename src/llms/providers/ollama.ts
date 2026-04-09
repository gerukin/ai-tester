import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import { envConfig } from '../../config/index.js'

const normalizeOllamaBaseUrl = (baseURL: string) => {
	return `${baseURL.replace(/\/(?:api|v1)\/?$/, '').replace(/\/$/, '')}/v1`
}

export default createOpenAICompatible({
	name: 'ollama',
	baseURL: normalizeOllamaBaseUrl(envConfig.AI_TESTER_OLLAMA_BASE_URL ?? 'http://localhost:11434'),
	supportsStructuredOutputs: true,
})
