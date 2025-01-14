import { createVertex } from '@ai-sdk/google-vertex';
import { envConfig } from '../../config/index.js';
// The application credentials are assumed to set in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable
// as expected by Google.
export default createVertex({
    location: envConfig.GOOGLE_VERTEX_AI_REGION,
    project: envConfig.GOOGLE_VERTEX_AI_PROJECT,
});
