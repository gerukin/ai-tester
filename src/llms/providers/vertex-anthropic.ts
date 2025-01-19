import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic'

import { envConfig } from '../../config/index.js'

// The application credentials are assumed to set in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable
// as expected by Google.
export default createVertexAnthropic({
	location: envConfig.GOOGLE_VERTEX_AI_REGION,
	project: envConfig.GOOGLE_VERTEX_AI_PROJECT,
})
