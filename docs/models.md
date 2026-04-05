# Providers and models

Providers and model versions are defined from YAML files and then synchronized into the database.

The main test config still references models with:

```yaml
provider: openai
model: gpt-4o-mini-2024-07-18
```

The `model` value above is the `providerModelCode` from the model YAML file.

## Provider files

Create one YAML file per provider under `AI_TESTER_PROVIDERS_DIR`.

The provider and model registry is required application configuration. The app does not start in a partially configured state, so create both directories and the initial YAML files before running model-aware commands.

Example:

```yaml
code: openrouter
name: OpenRouter
type: openai-compatible
baseURL: https://openrouter.ai/api/v1
apiKeyEnvVar: OPENROUTER_API_KEY
```

Supported provider runtime `type` values:

- `ollama`
- `openai`
- `vertex`
- `vertex-anthropic`
- `perplexity`
- `openai-compatible`

`openai-compatible` is the generic option for providers such as OpenRouter.

## Model files

Create one YAML file per runnable provider model under `AI_TESTER_MODELS_DIR`.

Example:

```yaml
code: gpt-4o-mini
provider: openai
providerModelCode: gpt-4o-mini-2024-07-18
active: true
costs:
  - costPerCall: 0
    costPerPromptToken: 0.00000015
    costPerCompletionToken: 0.0000006
    costPerHour: 0
    currency: USD
    validFrom: 2024-07-18
```

Fields:

- `code`: The internal shared model code used for grouping and analysis.
- `provider`: The provider code from the provider YAML file.
- `providerModelCode`: The provider-facing runtime model identifier.
- `extraIdentifier`: Optional provider-specific identifier.
- `active`: Optional model-version switch. Defaults to `true`. Inactive model versions are excluded from runs and reports.
- `costs`: Full cost history for this model version. This array is the source of truth.

## Activation rules

After syncing:

- providers, models, and model versions with YAML files are marked active
- rows missing from YAML are marked inactive
- historical sessions and evaluations remain in the database
- if a YAML file is restored later, the matching row becomes active again
- for multiple YAML entries sharing the same provider and `providerModelCode`, at most one may have `active: true`
- if more than one active variant exists for the same provider/model code, startup fails and you must set `active: false` on the older variants
- inactive providers, models, and model versions are excluded from new runs and reports

## Missing configured models

If the main config references a provider/model pair that is not currently available from YAML, the app prints a warning at startup and skips that entry. This behaves the same as omitting that model from the config.

## Cost history

For active model versions, the `costs` array in YAML fully owns the `model_costs` rows:

- YAML entries are inserted or updated
- DB rows not present in the YAML array are deleted
- if historical runs exist, the earliest YAML `validFrom` must be old enough to cover the oldest recorded run for that model version

## Migration from manual DB model data

Older setups may already have providers, models, and model versions in the database.

The transition is straightforward:

1. Add `AI_TESTER_PROVIDERS_DIR` and `AI_TESTER_MODELS_DIR` to your env file.
2. Create those directories on disk.
3. Convert each provider into a provider-only YAML file.
4. Convert each runnable model version into its own model YAML file, including full `costs` history.
5. Keep the main test config as `provider` + `model`, where `model` is the `providerModelCode`.
6. Run migrations.
7. Run the database sync from files.

Rows without matching YAML simply become inactive until corresponding YAML files exist. There is no separate legacy import mode.

Practical notes:

- If the registry directories are missing, the app fails at startup rather than guessing.
- If the main config references a provider/model pair that is not yet present in YAML, that entry is warned about and skipped.
- If historical runs exist for a model version, make sure the YAML `costs` history starts early enough to cover the oldest recorded run.
