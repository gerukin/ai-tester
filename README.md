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

Now you will need to create the necessary prompts, tests, and config file. Then add some data to the DB for your supported models. Refer to the [docs](/docs) for more information.

> [!IMPORTANT]
> Put all files (except `.env` and `.env.local`) which are not committed to the repository in the `.local` directory.

## Running the program

```sh
# This assumes the project is already built
npm run start

# Or to recompile and run the project:
npm run start:dev
```

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
