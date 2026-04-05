import type { ProviderDefinition } from '../config/model-registry.js'
import { getFileBackedModelRegistry } from '../config/model-registry.js'

import ollama from './providers/ollama.js'
import openai from './providers/openai.js'
import vertex from './providers/vertex.js'
import vertex_anthropic from './providers/vertex-anthropic.js'
import perplexity from './providers/perplexity.js'
import openaiCompatible from './providers/openai-compatible.js'

const providerFactories = {
	ollama: () => ollama,
	openai: () => openai,
	vertex: () => vertex,
	'vertex-anthropic': () => vertex_anthropic,
	perplexity: () => perplexity,
	'openai-compatible': (provider: Extract<ProviderDefinition, { type: 'openai-compatible' }>) =>
		openaiCompatible(provider),
} as const

export const getProvider = (providerCode: string) => {
	const provider = getFileBackedModelRegistry().providersByCode.get(providerCode)
	if (!provider) return undefined

	const providerFactory = providerFactories[provider.type]
	return providerFactory(provider as never)
}

export { wrapModel } from './helpers/wraper.js'
