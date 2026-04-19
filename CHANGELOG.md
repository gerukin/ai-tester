# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.20.0] - 2026-04-19

### Added

- Model YAML definitions can now declare stable `id` values and `uniqueProperties`, allowing multiple active definitions for the same provider model when runtime settings differ.

### Changed

- Test, evaluation, stats, and runtime override config now target model definitions by `id` instead of provider/model pairs.
- Model version sync now keys database versions by the effective runtime options used for candidate or evaluator calls, so adding an `id` alone does not invalidate existing runs.

## [0.19.1] - 2026-04-12

### Fixed

- OpenAI-compatible provider YAML can now opt into AI SDK structured outputs, and the bundled OpenRouter provider enables that support so structured-response runs and evaluator judgments use JSON schema response format instead of falling back to JSON object mode.

## [0.19.0] - 2026-04-12

### Added

- Model YAML files can now declare input/output capabilities, letting test and evaluation runs skip unsupported model/test pairs before provider calls.
- Sessions and evaluations now persist finish reasons and max output token limits, allowing likely token-limit hits to be rerun when the configured max output token limit increases.

## [0.18.1] - 2026-04-11

### Changed

- Packaged agent guidance now warns agents to run DB-accessing `ai-tester` commands sequentially to avoid local database locks.

## [0.18.0] - 2026-04-11

### Added

- `ai-tester list` can now list file-backed models, test tags, prompt codes, and currency codes for use in runtime overrides and ad hoc stats queries.

## [0.17.0] - 2026-04-11

### Added

- Runtime CLI overrides let headless `run-tests` and `run-evals` shallow-replace test and evaluation config fields from inline JSON or a JSON file.
- Dry-run test and evaluation commands can now include missing-work counts with `--include-counts`, using a temporary database copy so the real database is not mutated.
- Stats can now run ad hoc analysis queries from inline JSON or a JSON file, with dry-run validation for configured and ad hoc queries.
- A packaged `ai-tester` agent skill can now be synchronized into consuming projects with `ai-tester skills sync`.

## [0.16.0] - 2026-04-11

### Added

- A repository-native offline automated test suite covering runtime flows, sync flows, markdown parsing, config validation, stats, OpenRouter helpers, and app bootstrap.
- Headless `ai-tester` CLI subcommands for migrations, file-backed sync, missing test runs, missing evaluation runs, and stats queries.
- CLI help output via `-h` / `--help`, stats query listing via `ai-tester stats --list`, and dry-run previews for `run-tests` and `run-evals`.
- Analysis queries can now filter stats by candidate system prompt codes or exact prompt version hashes with `systemPrompts`.

### Changed

- Analysis query descriptions must now be unique because they can be selected exactly from the CLI.
- Frontmatter parsing now trims leading whitespace before the actual prompt or test body, matching the installed local corpus while avoiding off-by-one extraction behavior.
- Test parsing now treats only the last standalone `---` line as the start of evaluation instructions; earlier `---` usages remain part of the test content.
- Structured-object test sessions and evaluator judgments now persist reasoning traces when providers return them.
- Prompt and test sync now fail fast when replacement expansion leaves unresolved non-runtime placeholders.

## [0.15.0] - 2026-04-09

> [!WARNING]
> If you are upgrading from `v0.14.0`, read the migration guide first: [v0.14.0 to v0.15.0](/docs/migration-guides/0.14.0-0.15.0.md)
>
> You should also read the [AI SDK 6 upgrade note](/docs/migration-guides/ai-sdk-6-upgrade.md).

### Added

- Currencies and exchange-rate histories can now be defined from YAML files and synchronized into the database.
- New optional `AI_TESTER_CURRENCIES_DIR` environment variable for a file-backed currency registry.

### Changed

- The `Update the database from files` workflow now synchronizes file-backed currencies before the other registries.
- Manual SQL is no longer the recommended path for app-owned exchange-rate data; it remains available for schema changes and custom/private SQL assets.
- Upgraded the runtime from Vercel AI SDK 4 to AI SDK 6 and refreshed the provider packages accordingly.
- Structured outputs now run through AI SDK 6 `generateText` with `Output.object`, while keeping the existing on-disk schema format unchanged.
- Tool definition YAML files still use `parameters:` for compatibility, but the runtime now maps them to AI SDK 6 `inputSchema` internally.
- OpenAI models continue to use the chat-completions provider path internally; the upgrade does not switch ai-tester to the Responses API by default.
- Ollama now runs through the OpenAI-compatible transport and normalizes `AI_TESTER_OLLAMA_BASE_URL` to the `/v1` endpoint automatically.
- Raised the minimum supported `zod` version for this repo to `^3.25.76`.
- Runs now fail instead of persisting invented prompt/completion token totals when supported providers expose partial raw usage data, including OpenAI-compatible, Anthropic, and Google/Vertex.
- Cache token detail fields are now only persisted when the provider's raw usage payload actually reports them, avoiding invented zero cache counts.

## [0.14.0] - 2026-04-08

> [!WARNING]
> If you are upgrading from `v0.13.0`, read the migration guide first: [v0.13.0 to v0.14.0](/docs/migration-guides/0.13.0-0.14.0.md)

### Added

- Providers and models can now be defined from YAML files and synchronized into the database, instead of being maintained manually in SQL.
- OpenAI-compatible providers can now be registered from provider YAML files, which allows services such as OpenRouter or other compatible endpoints to be configured directly.
- Model YAML files can now define provider-specific runtime options and thinking settings on a per-model basis.

### Changed

- Model costs are now owned by the `costs` array in each model YAML file and synchronized as the source of truth.
- Providers, models, and model versions missing from YAML are now marked inactive instead of remaining implicitly available for new runs.
- Main config entries that reference unavailable provider/model pairs are now warned about and skipped instead of failing outright.
- Runtime model behavior that was previously hardcoded for specific providers/models is now defined in model YAML.
- Version-specific migration guides now live under `docs/migration-guides/`.

## [0.13.0] - 2025-07-27

### Added

- Logging capabilities for model calls and error handling. All model call errors are now automatically logged, and errors are better displayed in the CLI.
- Model evaluations and tests now support setting thinking and output token limits via environment variables.
- Global model timeout value can now be set as an environment variable.

> [!IMPORTANT]
> New required environment variable: `AI_TESTER_LOGS_DIR` for specifying log storage location.

### Changed

- Improved error handling in evaluations and tests: failed tests are now skipped instead of aborting the run.

## [0.12.1] - 2025-07-25

### Fixed

- Catch reasoning traces for all Ollama models by default. It is assumed that the standard `think` tag is generally used (an override can be added in the future for specific models).

## [0.12.0] - 2025-07-22

### Added

- Tool calling support for tests and evaluations. Models can now use tools and output tool calls, which are injected as responses and evaluated.

### Changed

- Evaluation logic now accounts for currently active candidate model configurations, allowing more flexible and targeted evaluation scenarios.

## [0.11.0] - 2025-07-15

### Added

- Structured objects support. It is now possible to specify structured objects with a particular schema as the output in tests.
- Support for file references in tests, allowing the LLM to read files from the filesystem as input to the test.

## [0.10.3] - 2025-07-05

### Fixed

- Model cost calculation now correctly accounts for multiple pricing records, ensuring accurate cost tracking for models with changing prices.
- Currency rate calculation now avoids duplications and finds the closest rate in time, preferring past rates if available.

## [0.10.2] - 2025-06-29

### Changed

- Statistics now prioritize models with higher pass rates and lower cost per session, making it easier to identify the most cost-effective models.

## [0.10.1] - 2025-06-29

### Changed

- Enhanced model wrapping: Known models now apply provider-specific properties and middleware integration for more effective handling of thinking models.

## [0.10.0] - 2025-06-29

### Added

- Enhanced statistics calculation: now orders by pass rate and cost per session for improved insights.
- Updated token and reasoning effort constants for tests and evaluations, providing more accurate evaluation metrics.

## [0.9.4] - 2025-03-02

### Added

- Preliminary support for reasoning models (limited to Deepseek-R1 on Ollama) with hardcoded maximum 120 sec and 1500 token limits (this will be configurable in the future).
- Simple view in the database to review answers and evaluations more easily.
- Simple statistics configurable in the config file.
- Menu to simplify updating tests / prompts, or accessing simple stats.

### Changed

- Trim whitespaces from answers and evaluation feedback.

## [0.9.3] - 2025-02-09

### Changed

- Better documentation for contributors and small example updates.

## [0.9.2] - 2025-01-19

> [!IMPORTANT]
> Run the migrations and refer to the [example SQL](/docs/example/data/sql/2025-01-19-01-add-currencies-and-model-costs.sql) to insert cost data for models.
>
> You should also update your Vertex AI Claude models to use the new Anthropic provider (add the provider to your DB, then switch your model version to it).

### Added

- Ability to keep track of model costs over time in the database.
- Now counting cached tokens for OpenAI and Anthropic. However, no attempt is made to specifically cache tokens as of yet (besides OpenAi's automatic caching rule).

### Changed

- Switched to the new Vertex AI Anthropic provider for all Vertex AI claude models.
- Default openai 4o model version in examples updated to reflect the latest version.

## [0.9.1] - 2025-01-18

### Added

- Now auto skips evaluations which fail to be generated properly by the model.

## [0.9.0] - 2025-01-15

### Added

- 🎉 Version `0.9.0` is out... with all the base features. It isn't quite yet stable or tested enough to be relied upon.

[Unreleased]: https://github.com/gerukin/ai-tester/compare/v0.20.0...HEAD
[0.20.0]: https://github.com/gerukin/ai-tester/compare/v0.19.1...v0.20.0
[0.19.1]: https://github.com/gerukin/ai-tester/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/gerukin/ai-tester/compare/v0.18.1...v0.19.0
[0.18.1]: https://github.com/gerukin/ai-tester/compare/v0.18.0...v0.18.1
[0.18.0]: https://github.com/gerukin/ai-tester/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/gerukin/ai-tester/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/gerukin/ai-tester/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/gerukin/ai-tester/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/gerukin/ai-tester/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/gerukin/ai-tester/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/gerukin/ai-tester/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/gerukin/ai-tester/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/gerukin/ai-tester/compare/v0.10.3...v0.11.0
[0.10.3]: https://github.com/gerukin/ai-tester/compare/v0.10.2...v0.10.3
[0.10.2]: https://github.com/gerukin/ai-tester/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/gerukin/ai-tester/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/gerukin/ai-tester/compare/v0.9.4...v0.10.0
[0.9.4]: https://github.com/gerukin/ai-tester/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/gerukin/ai-tester/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/gerukin/ai-tester/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/gerukin/ai-tester/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gerukin/ai-tester/releases/tag/0.9.0
