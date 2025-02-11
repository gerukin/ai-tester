import { createPerplexity } from '@ai-sdk/perplexity';
import { envConfig } from '../../config/index.js';
export default createPerplexity({
    apiKey: envConfig.PERPLEXITY_API_KEY,
});
