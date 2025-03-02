# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Preliminary support for reasoning models (limited to Deepseek-R1 on Ollama) with hardcoded maximum 120 sec and 1500 token limits (this will be configurable in the future).
- Simple view in the database to review answers and evaluations more easily.
- Simple statistics configurable in the config file.
- Menu to simplify updating tests / prompts, or accessing simple stats.

### Changed

- Trim whitespaces from answers and evaluation feedback.

## [0.9.2] - 2025-19-01

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

## [0.9.1] - 2025-18-01

### Added

- Now auto skips evaluations which fail to be generated properly by the model.

## [0.9.0] - 2025-15-01

### Added

- 🎉 Version `0.9.0` is out... with all the base features. It isn't quite yet stable or tested enough to be relied upon.

[Unreleased]: https://github.com/gerukin/ai-tester/compare/v0.9.2...HEAD
[0.9.2]: https://github.com/gerukin/ai-tester/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/gerukin/ai-tester/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/gerukin/ai-tester/releases/tag/0.9.0
