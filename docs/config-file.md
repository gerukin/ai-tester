# Config file options

The config file is the sole source of truth for the current tests and evaluations. Current and past tests/evals are stored in the database (see [Historical data](environment-variables.md)).

## Creating the config file

You config file can be created anywhere and named anything, but the path to it must be set as the `AI_TESTER_CONFIG_PATH` environment variable (typically in your `.env` or `.env.local` file).

```env
AI_TESTER_CONFIG_PATH=.local/ai-tester.config.yaml
```

## Config file format

```yaml
# Description: Configuration file for the tests to run

# Model versions to test
# 🚨 the `model` key is a reference to the model version in the database (not the model name)
candidates:
  - provider: ollama
    model: gemma2:2b-instruct-q8_0
  - provider: ollama
    model: gemma2:9b-instruct-q4_K_M

    # The options here are per model options, and can be applied to candidate or evaluator models
    # [optional] Default temperature to apply to this model (overriding the global default temperature)
    temperature: 0.5

    # [optional] Test tags which must be included in this run (the test runs if it matches any of the tags)
    requiredTags:
      - reasoning

    # [optional] Test tags to exclude from this run (the test runs if it does not match any of the tags)
    prohibitedTags:
      - math
      - off_topic

# [optional] Default temperature to apply to all models being tested
# Note: the tests will be re-run for each different temperature
candidatesTemperature: 0.3

# [optional] Number of responses generated per test
attempts: 1

# [optional] Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags2)
requiredTags1:
  - lang_en

# [optional] Test tags which must be included in this run (the test runs if it matches any of the tags - in addition to satisfying requiredTags1)
requiredTags2:
  - off_topic

# [optional] Test tags to exclude from this run (the test runs if it does not match any of the tags)
prohibitedTags:
  - example
  - lang_ja

# Models to use to evaluate the generated responses
evaluators:
  - provider: ollama
    model: gemma2:9b-instruct-q4_K_M
  - provider: ollama
    model: mistral-nemo:12b-instruct-2407-q4_K_M

    # The same options as for candidate models can be applied to evaluator models

# [optional] Default temperature to apply to all evaluators
# Note: the tests will be re-run for each different temperature
evaluatorsTemperature: 0.5

# [optional] Total number of evaluations per response per evaluator
evaluationsPerEvaluator: 2
```

### Providers

A provider is any service which gives access to model inference, either through an API or a local service. Each provider exposes one or more models.

### Model versions

A model version is a specific version of a model. Each model version is associated with a provider, and has specific characteristics (e.g. cost, max tokens, etc.) and supported features (e.g. Json mode, tools, etc.).

> [!NOTE]
> Support for additional features is planned for future versions of this package.

> [!IMPORTANT]
> The `model` key in the config file is a reference to the model version in the database (not the model name).

#### Models

The concept of `models` is kept in the database as well, and they are essentially groups to hold model versions. Each model can have multiple versions (potentially from different providers). This is NOT used in the config file, but can be useful for analysis.
