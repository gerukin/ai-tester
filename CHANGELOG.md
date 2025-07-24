# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/gerukin/ai-tester/compare/v0.12.1...HEAD
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
