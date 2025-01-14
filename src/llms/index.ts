import ollama from './providers/ollama.js'
import openai from './providers/openai.js'
import vertex from './providers/vertex.js'
import perplexity from './providers/perplexity.js'

export const providers = {
	ollama,
	openai,
	vertex,
	perplexity,
} as const
