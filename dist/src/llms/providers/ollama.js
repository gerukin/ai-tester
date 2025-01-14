import { createOllama } from 'ollama-ai-provider';
import { envConfig } from '../../config/index.js';
export default createOllama({
    baseURL: envConfig.AI_TESTER_OLLAMA_BASE_URL,
});
