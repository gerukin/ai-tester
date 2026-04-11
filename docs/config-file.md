# Config file options

The config file is the source of truth for which tests, evaluations, and analysis queries should run. Current and past runs are stored in the database.

The `provider` + `model` references in this file are matched against the active provider/model YAML registry described in [models.md](models.md).

If a referenced provider/model pair is not currently available, the app prints a warning at startup and skips that entry.

## Creating the config file

Your config file can be created anywhere and named anything, but the path must be set as `AI_TESTER_CONFIG_PATH`.

```env
AI_TESTER_CONFIG_PATH=.local/ai-tester.config.yaml
```

## Config file format

```yaml
# Description: Configuration file for the tests to run

# Model versions to test
# 🚨 the `model` key is the providerModelCode from the corresponding model YAML file
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

# Queries to analyze the results can be preset here and will be available in the menu
analysisQueries:
  # Description of the query (shown in the menu)
  - description: Phi4 only - reasoning in english (JPY costs)

    # Currency to use for cost analysis
    currency: JPY

    # [optional] Tags can be applied to analysis queries as well
    # (not specified means no restriction for this query - it does not mean that default tags are applied)
    requiredTags1:
      - lang_en
    requiredTags2:
      - reasoning

    # [optional] Candidate system prompts to include in the stats.
    # Entries can be prompt ids/codes or exact prompt version hashes, and are ORed together.
    systemPrompts:
      - helpful-en
      - 4b7f2c...

    # [optional] Temperature to apply to models in analysis queries
    # (not specified means no temperature is applied)
    candidatesTemperature: 0.5
    # evaluatorsTemperature: 0.5

    # [optional] Candidate model versions to include - follows a similar format to the main section
    candidates:
      - provider: ollama
        model: phi4:14b-q4_K_M

        # temperature and tags can be applied to models in analysis queries as well
        # (not specified means no restriction for this model)

    # [optional] Evaluators to include - follows a similar format to the main section
    evaluators:
      - provider: ollama
        model: phi4:14b-q4_K_M

        # temperature and tags can be applied to models in analysis queries as well
        # (not specified means no restriction for this model)
```

### Model references

A provider/model pair in the config maps to:

- a provider YAML file
- a model YAML file whose `providerModelCode` matches the `model` value

The model grouping `code` from the model YAML is not used directly in this config file.

### Analysis queries

Analysis queries are a way to pre-define queries to run on the database. These queries can be run from the menu, and can be filtered by tags. The results of these queries are shown in a table with various metrics:

- `Model`: The model version and provider which was tested
- Pass rate: The percentage of evaluations which passed
- Sessions: The number of sessions which were evaluated
- Tests: The number of tests which were evaluated
- Evaluations: The number of evaluations which were generated
- Cost per 100 sessions: The cost of the evaluations per 100 sessions (in the specified currency)
- Total cost: The total cost of the evaluations (in the specified currency)

Analysis query descriptions must be unique. The CLI uses the exact description string for `ai-tester stats --query "<description>"`, so duplicate descriptions are rejected during config validation.

Analysis queries can also be scoped by candidate system prompt with `systemPrompts`. Each list entry is matched against either the stable prompt `id`/database `code` or an exact prompt version hash. Entries are ORed together, so a session is included when its candidate system prompt matches any listed value. Omit `systemPrompts` or set it to an empty list to leave system prompts unrestricted.

### Runtime CLI overrides

Headless commands can replace the relevant config-file fields for one run without editing `AI_TESTER_CONFIG_PATH`.
The payload is JSON and uses the same field names and validation rules as the config file.
Overrides are shallow: an omitted field keeps the config-file value, while a provided array replaces that whole array.
Use the CLI to list file-backed values for runtime overrides:

```sh
ai-tester list --models
ai-tester list --tags
ai-tester list --prompts
ai-tester list --currencies
```

```sh
ai-tester run-tests --config-overrides '{"attempts":2,"requiredTags1":["smoke"]}'
ai-tester run-tests --dry-run --include-counts --config-overrides '{"requiredTags2":["cat_math"]}'
ai-tester run-evals --config-overrides-file .local/eval-overrides.json
ai-tester stats --query-json '{"currency":"USD","requiredTags1":["smoke"],"systemPrompts":["helpful"]}'
ai-tester stats --dry-run --query-file .local/stats-query.json
```

`run-tests` accepts candidate models, candidate temperature, attempts, and required/prohibited tags.
`run-evals` accepts candidate and evaluator models, candidate and evaluator temperatures, evaluations per evaluator, and required/prohibited tags.
Add `--include-counts` to a dry-run test or evaluation command to sync a temporary copy of the configured database and print the missing work count without touching the real database.
Ad hoc stats queries accept the same fields as entries in `analysisQueries`; `description` may be omitted and defaults to `Ad hoc query`.

> [!NOTE]
> Only active tests with completed evaluations are shown in the analysis queries.
>
> Model costs come from model YAML files. Currency exchange rates come from currency YAML files when `AI_TESTER_CURRENCIES_DIR` is configured; otherwise they are read from the existing database rows. If you do not use currency YAML files, you are responsible for seeding the needed currency rows and exchange-rate history yourself; without those rows, cost conversion for that currency will not be available.
