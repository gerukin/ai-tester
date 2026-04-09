import { createOpenAI } from '@ai-sdk/openai'

import { envConfig } from '../../config/index.js'

const openai = createOpenAI({
	apiKey: envConfig.OPENAI_API_KEY,
})

export default ((modelId: Parameters<typeof openai.chat>[0]) => openai.chat(modelId)) as typeof openai.chat
