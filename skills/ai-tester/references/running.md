# Running AI Tester

Use this reference for routine `ai-tester` work when the dependency is already installed.

## Before Running

Before mutating the database or calling models, inspect:

- package scripts and package manager
- `.env`, `.env.local`, and `AI_TESTER_CONFIG_PATH`
- provider/model YAML directories and active model references
- test, prompt, currency, structured schema, and tool definition directories
- tag filters, attempts, evaluator settings, and evaluation counts

Config, model, prompt, test, tag, attempt, temperature, or evaluator changes can create new missing test/evaluation work.

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
ai-tester run-tests --dry-run --config-overrides '{"requiredTags1":["smoke"]}'
ai-tester run-evals --config-overrides-file .local/eval-overrides.json
```

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
ai-tester stats --dry-run --query-file .local/stats-query.json
```

Use interactive mode only when a human should choose from menus:

```sh
ai-tester
```
