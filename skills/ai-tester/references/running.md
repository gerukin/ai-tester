# Running AI Tester

Use this reference for routine `ai-tester` work when the dependency is already installed.

## CLI-First Rule

Use the CLI as the primary interface. Prefer `ai-tester --help`, subcommand `--help`, `--dry-run`, `--include-counts`, `stats --list`, and runtime JSON overrides over reading config internals or querying the database.

When you need models, tags, prompt codes, or currencies to use in overrides, ask the CLI instead of inspecting config files or the database:

```sh
ai-tester list --models
ai-tester list --tags
ai-tester list --prompts
ai-tester list --currencies
ai-tester list --models --tags --prompts --currencies
```

Avoid direct database access for routine work. Do not open SQLite, run SQL, inspect Drizzle tables, or read DB rows just to find available work or stats. Use direct DB inspection only when the user explicitly asks for it, the task is to debug ai-tester internals, or a CLI error points to a database corruption/migration issue that the CLI cannot explain.

Run DB-accessing `ai-tester` commands sequentially because the local database can lock. Do not parallelize `sync`, `migrate`, `run-tests`, `run-evals`, stats queries, or dry runs that include DB checks/counts. File-backed listing commands such as `ai-tester list --models --tags --prompts --currencies` are safe to run separately.

Keep file inspection narrow. Read package scripts only to choose the package-manager command. Read `.env`, `.env.local`, or `AI_TESTER_CONFIG_PATH` only if a CLI command cannot locate its config, or if the user asks you to change configuration files. Read model/prompt/test YAML or markdown only when editing those files or when CLI output names a specific missing/invalid file.

When the user names models, tags, attempts, temperatures, evaluator counts, system prompts, currencies, or other scope details, pass them through runtime overrides or ad hoc stats JSON. Do not fall back to predefined config just because an override takes a little more JSON.

Use the predefined config when the user asks for the standard/default project run or gives no specific scope. Use predefined analysis queries when the user asks for an existing/preconfigured report or does not specify query details.

## Dry Runs

Prefer dry runs before expensive work:

```sh
ai-tester run-tests --dry-run
ai-tester run-evals --dry-run
ai-tester run-tests --dry-run --include-counts
ai-tester run-evals --dry-run --include-counts
```

Use runtime overrides for temporary scope changes instead of editing config:

```sh
ai-tester run-tests --dry-run --config-overrides '{"attempts":2,"requiredTags1":["smoke"],"candidates":[{"id":"openai/gpt-4o-mini-2024-07-18/default"}]}'
ai-tester run-evals --dry-run --config-overrides '{"requiredTags2":["reasoning"],"evaluationsPerEvaluator":2,"evaluators":[{"id":"openai/gpt-4o-mini-2024-07-18/default"}]}'
ai-tester run-evals --config-overrides-file .local/eval-overrides.json
```

`run-tests` overrides can include `candidates`, `candidatesTemperature`, `attempts`, `requiredTags1`, `requiredTags2`, and `prohibitedTags`.

`run-evals` overrides can include all test-run override fields plus `evaluators`, `evaluatorsTemperature`, and `evaluationsPerEvaluator`.

Model entries use `{ "id": "..." }`, where `id` is the model definition id from the configured model registry. Per-model `temperature`, `requiredTags`, and `prohibitedTags` are also valid when the user asks for model-specific scope.

## Sync, Runs, And Stats

Sync file-backed state into the database:

```sh
ai-tester sync
```

Run tests/evaluations only after dry-run scope matches the intended work:

```sh
ai-tester run-tests
ai-tester run-evals
```

For stats, list configured queries first:

```sh
ai-tester stats --list
ai-tester stats --query "My query description"
```

Use the listed configured query when the user asks for that named query, an existing report, or gives no special filters. If the user gives specific models, tags, prompts, temperatures, evaluators, or currency, use an ad hoc stats query instead:

```sh
ai-tester stats --dry-run --query-json '{"currency":"USD","requiredTags1":["smoke"],"candidates":[{"id":"openai/gpt-4o-mini-2024-07-18/default"}]}'
ai-tester stats --query-json '{"currency":"JPY","systemPrompts":["helpful"],"requiredTags2":["reasoning"],"candidatesTemperature":0.2}'
ai-tester stats --dry-run --query-file .local/stats-query.json
```

Ad hoc stats queries accept `currency`, `requiredTags1`, `requiredTags2`, `prohibitedTags`, `systemPrompts`, `candidates`, `evaluators`, `candidatesTemperature`, and `evaluatorsTemperature`.

Use interactive mode only when a human should choose from menus:

```sh
ai-tester
```
