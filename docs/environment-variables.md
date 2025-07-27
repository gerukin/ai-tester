# Environment variables

By default, the AI Tester loads your existing environment variables (highest priority), then `.env.local` (high priority), and then `.env` (lowest priority).

The following environment variables are used by the AI Tester...

## Mandatory variables

- `AI_TESTER_SQLITE_DB_PATH`: Path to the SQLite database used by the local developer only. Example: `.local/data/sqlite.db`.
- `AI_TESTER_LOGS_DIR`: Path to the logs directory (relative to the root of the project). Example: `.local/data/logs`.
- `AI_TESTER_TESTS_DIR`: Path to the tests directory (relative to the root of the project). Example: `.local/data/tests`.
- `AI_TESTER_PROMPTS_DIR`: Path to the prompts directory (relative to the root of the project). Example: `.local/data/prompts`.

## Optional variables

- `AI_TESTER_STRUCTURED_SCHEMAS_DIR`: Path to the structured schemas directory. Example: `.local/data/structured-schemas`.
- `AI_TESTER_TOOL_DEFINITIONS_DIR`: Path to the tool definitions directory. Example: `.local/data/tool-definitions`.

> [!IMPORTANT]
> If you plan on using structured schemas or tool definitions, you must set the `AI_TESTER_STRUCTURED_SCHEMAS_DIR` and `AI_TESTER_TOOL_DEFINITIONS_DIR` variables respectively. If you do not plan on using them, you can omit these variables.

## Optional variables (with defaults)

- `AI_TESTER_CONFIG_PATH`: Path to the configuration file. Example: `.local/ai-tester.config.yaml`.
- `MAX_WAIT_TIME`: The maximum time (in milliseconds) the model can take to answer a test or an evaluation. Default: `120000` (120 seconds).
- `MAX_TEST_OUTPUT_TOKENS`: The maximum number of tokens the model can use to answer a test. Default: `7000`.
- `MAX_TEST_THINKING_TOKENS`: The maximum number of tokens the model can use to think about a test. Default: `5000`.
- `MAX_EVALUATION_OUTPUT_TOKENS`: The maximum number of tokens the model can use to generate an evaluation. Default: `2500`.
- `MAX_EVALUATION_THINKING_TOKENS`: The maximum number of tokens the model can use to think about an evaluation. Default: `2000`.

> [!NOTE]
> The max output tokens for tests and evaluations should always be greater than or equal to the corresponding max thinking tokens. For example, `MAX_TEST_OUTPUT_TOKENS` should not be less than `MAX_TEST_THINKING_TOKENS`.

> [!IMPORTANT]
> All variables here can be omitted and will use the default values shown above.

## Model provider variables

If not using a specific model provider, you can ignore the corresponding environment variables below.

### Ollama

- `AI_TESTER_OLLAMA_BASE_URL`: The base URL of the OLLAMA server (including the port but without the OLLAMA specific path). Example: `http://localhost:11434/api`.

### OpenAI

- `OPENAI_API_KEY`: Your OpenAI API key.

### Google Cloud (Vertex AI)

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to the Google Cloud credentials file (if not using the default path). Example: `/Users/someone/.config/gcloud/special-adc-version.json`.
- `GOOGLE_VERTEX_AI_REGION`: The region of the Google Vertex AI models. Example: `us-central1`.
- `GOOGLE_VERTEX_AI_PROJECT`: The project of the Google Vertex AI models. Example: `my-project-123456`.

### Perplexity

- `PERPLEXITY_API_KEY`: Your Perplexity API key.
