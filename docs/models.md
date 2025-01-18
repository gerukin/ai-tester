# Models

Models are defined in the configuration file under the `candidates` and `evaluators` keys. Each model is defined by a `provider` and a `model` key. The `provider` key specifies the model provider, and the `model` key specifies the model identifier. The model identifier is a string that uniquely identifies the model. The model identifier is used to fetch the model from the model provider.

Officially supported model providers are:

- `ollama`: Ollama models
- `openai`: OpenAI models
- `vertex`: Vertex AI models
- `perplexity`: Perplexity models
