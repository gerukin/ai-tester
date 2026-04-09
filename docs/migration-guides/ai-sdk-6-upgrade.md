# AI SDK 6 upgrade note

This repository now targets Vercel AI SDK 6.x.

## Package baseline

- `ai`: `^6`
- installed `@ai-sdk/*` providers updated to their AI SDK 6-compatible major lines
- `zod`: `^3.25.76` or newer

## Compatibility notes

- Tool definition YAML files still use `parameters:` on disk.
  The runtime maps that field to AI SDK 6 `inputSchema` internally, so existing tool definition files do not need to be renamed.
- Structured object schema files keep the same JSON Schema format as before.
  The runtime now sends them through AI SDK 6 structured output support internally.
- Message generation now uses AI SDK 6 `ModelMessage` types internally.
- OpenAI-backed runs stay on the chat-completions provider path internally.
  The upgrade does not switch ai-tester to the OpenAI Responses API by default.

## Ollama note

Ollama is now wired through the OpenAI-compatible provider path used by AI SDK 6.

- Keep using `AI_TESTER_OLLAMA_BASE_URL` as the Ollama server root, for example `http://localhost:11434`.
- The runtime normalizes older values ending in `/api` or `/v1` and sends requests to the OpenAI-compatible `/v1` endpoint.

## Behavior changes worth noting

- Token accounting now reads AI SDK 6 usage fields (`inputTokens`, `outputTokens`, cache read/write details) instead of older provider-specific metadata paths.
- When supported providers expose partial raw usage payloads, the runtime now fails the run instead of persisting invented zero token totals.
  This guard currently covers OpenAI-compatible, Anthropic, and Google/Vertex usage shapes.
- Cache token detail fields are only persisted when the provider's raw usage payload actually reports them.
- Structured test/evaluation runs still persist the same answer/evaluation payloads in the database.
