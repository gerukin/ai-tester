# AI tester (LLM tests)

> [!IMPORTANT]
> To use this as a dependency in your own project, please refer to the [docs](/docs) instead.

Contributors checking out this repository locally, please keep reading.

## Getting started

```sh
npm install
```

Create a `.env` file and/or a `.env.local` file at the root of the directory, following the docs and [example](/docs/example).

Then run the [migrations](#migrations).

Now you will need to create the necessary prompts, tests, config file, provider YAML files, and model YAML files. Refer to the [docs](/docs) for more information.

> [!IMPORTANT]
> Put all files (except `.env` and `.env.local`) which are not committed to the repository in the `.local` directory.

## Skills

The distributable skill in `skills/ai-tester` is maintained for agents working in consuming projects that depend on `ai-tester`.
It is separate from repo-local contributor skills under `.agents/skills`.

## Running the program

```sh
# This assumes the project is already built and opens the interactive menu
npm run start

# Or to recompile and run the project:
npm run start:dev
```

### CLI commands

```sh
# Show help
ai-tester --help
ai-tester stats --help
ai-tester list --models
ai-tester list --tags --prompts --currencies

# Run migrations
ai-tester migrate

# Sync file-backed state into the DB
ai-tester sync

# Install the packaged ai-tester skill into a consuming project
ai-tester skills sync
ai-tester skills sync --replace

# Dry-run the expensive run flows
ai-tester run-tests --dry-run
ai-tester run-evals --dry-run
ai-tester run-tests --dry-run --include-counts
ai-tester run-evals --dry-run --include-counts
ai-tester run-tests --dry-run --config-overrides '{"attempts":2,"requiredTags1":["smoke"]}'
ai-tester run-evals --dry-run --config-overrides-file .local/eval-overrides.json

# Execute them headlessly
ai-tester run-tests
ai-tester run-evals
ai-tester run-tests --config-overrides '{"candidatesTemperature":0.2}'

# List and run configured or ad hoc analysis queries
ai-tester stats --list
ai-tester stats --query "My query description"
ai-tester stats --query-json '{"currency":"USD","requiredTags1":["smoke"]}'
ai-tester stats --dry-run --query-file .local/stats-query.json
```

`ai-tester` with no arguments keeps the current interactive behavior. The `run-tests` and `run-evals` commands automatically sync currencies, providers, structured objects, tools, prompts, and tests before executing missing work.
Non-interactive run commands can shallow-replace the relevant config-file fields at runtime with `--config-overrides` or `--config-overrides-file`; omitted fields keep their config-file values.

## Automated tests

```sh
npm test
```

The automated suite runs offline and does not require live model credentials.

Ollama coverage in this repository is exercised through deterministic stubbed tests rather than a live Ollama server.

## Migrations

Generate a migration file from changes in the schema:

```sh
npm run migrations:gen
```

Prepare a blank migration file for custom SQL:

```sh
npm run migrations:gen:custom
```

Run outstanding migrations:

```sh
npm run migrations:run
```

## JS runtimes

See the package.json `engines` field for tested versions of each runtime. Node is the default runtime for script targets.

```sh
# Recompile once and run the project:
npm run start:dev
```

### Node

```sh
npm run start
```

### Deno

Permissions needed:

- `--allow-env`
- `--allow-read`
- `--allow-run`
- `--allow-sys`
- `--allow-net`
- `--allow-ffi`

### Bun

> [!WARNING]
> Bun is not currently being tested and will likely break unpredictably.
> At the time of writing this guide, it fails to use the Vertex AI models (hangs indefinitely),
> and likely has other failure modes as well.

## Publishing

> [!TIP]
> Ask copilot to guide you and work out the changes using the `create-new-version` prompt.

```sh
# patch version
npm run publish:patch

# # minor version
# npm run publish:minor

# # major version
# npm run publish:major

git push --tags
```

### Changes

All changes must be documented in the [changelog](CHANGELOG.md).
