import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import { envConfig } from '../../config/index.js'

export default createOpenAICompatible({
	name: 'perplexity',
	apiKey: envConfig.PERPLEXITY_API_KEY,
	baseURL: 'https://api.perplexity.ai/',
})
