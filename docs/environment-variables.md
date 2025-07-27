# Environment variables

By default the AI tester will load first your existing environment variables (highest priority), then your `.env.local` variables (high priority) and then `.env` (lowest priority).

The following environment variables are used by the AI Tester...

## General

- `AI_TESTER_SQLITE_DB_PATH`: Path to the SQLite database that is used by the local developer only. It's ok to break it - it is reset from the shared database every time tests are run. Example: `.local/data/sqlite.db`.
- `AI_TESTER_LOGS_DIR`: Path to the logs directory (relative to the root of the project). Example: `.local/data/logs`.
- `AI_TESTER_TESTS_DIR`: Path to the tests directory (relative to the root of the project). Example: `.local/data/tests`.
- `AI_TESTER_PROMPTS_DIR`: Path to the prompts directory (relative to the root of the project). Example: `.local/data/prompts`.
- `AI_TESTER_STRUCTURED_SCHEMAS_DIR`: Path to the structured schemas directory (relative to the root of the project). Example: `.local/data/structured-schemas`.
- `AI_TESTER_TOOL_DEFINITIONS_DIR`: Path to the tool definitions directory (relative to the root of the project). Example: `.local/data/tool-definitions`.
- `AI_TESTER_CONFIG_PATH`: Path to the configuration file (relative to the root of the project). Example: `.local/ai-tester.config.yaml`.
- `MAX_WAIT_TIME`: The maximum time (in milliseconds) the model can take to answer a test or an evaluation. Default: `120000` (120 seconds).

> [!IMPORTANT]
> All variables above except `MAX_WAIT_TIME` are required and have no default values.

## Model providers

If not using a specific model provider, you can ignore the corresponding environment variables.

### Ollama

- `AI_TESTER_OLLAMA_BASE_URL`: This must be the base URL of the OLLAMA server (including the port but without the OLLAMA specific path). Example: `http://localhost:11434/api`.

### OpenAI

- `OPENAI_API_KEY`: Your OpenAI API key.

### Google Cloud (Vertex AI)

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to the Google Cloud credentials file (if not using the default path). Example: `/Users/someone/.config/gcloud/special-adc-version.json`.
- `GOOGLE_VERTEX_AI_REGION`: The region of the Google Vertex AI models. Example: `us-central1`.
- `GOOGLE_VERTEX_AI_PROJECT`: The project of the Google Vertex AI models. Example: `my-project-123456`.

### Perplexity

- `PERPLEXITY_API_KEY`: Your Perplexity API key.
