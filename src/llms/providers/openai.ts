import { createOpenAI } from '@ai-sdk/openai'

import { envConfig } from '../../config/index.js'

export default createOpenAI({
	apiKey: envConfig.OPENAI_API_KEY,
	compatibility: 'strict', // strict mode, enable when using the OpenAI API
})
