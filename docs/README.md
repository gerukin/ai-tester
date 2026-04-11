# AI tester docs

> [!WARNING]
> This guide assumes you have NodeJS installed, using a version `>=23.6.0`.

For all sections here, you can refer to the [example files](example/).

## Usage

Make sure you have followed the [getting started](#getting-started) steps.

```sh
npm run start
```

> [!NOTE]
> This uses the default runtime, Node.

## Agent skill

If you use Codex or another agent with local skills, install the packaged `ai-tester` skill into your project:

```sh
ai-tester skills sync
```

If `.agents/skills/ai-tester` already exists, the command asks before replacing it in an interactive terminal.
Unattended runs fail unless `--replace` is set:

```sh
ai-tester skills sync --replace
```

## Getting started

In your root directory, copy the `package.json` file from the `example` directory. Then run:

```sh
npm install

# or for yarn
# yarn install
```

Basic steps:

1. Create your [environment variables](environment-variables.md).
2. Create your [prompts](prompts.md).
3. Create your [tests and evaluations](tests-and-evaluations.md).
4. Create your [configuration file](config-file.md).
5. Create your [provider and model YAML files](models.md).
6. Add currency YAML files if you want file-backed exchange rates.
7. Add any remaining [manual SQL data](sql-data.md) for custom/private SQL assets.

Only after that should you run [migrations](#database-migrations) or any other command.

## Database migrations

This must be done the first time and after any changes to the version of this project you are using.

```sh
npm run migrations:run

# or for yarn
# yarn migrations:run
```

> [!NOTE]
> This uses the default runtime, Node.

## Updating

You can switch to a newer compatible version of the project by running:

```sh
npm update @gerukin/ai-tester

# or for yarn
# yarn upgrade @gerukin/ai-tester
```

Breaking changes will be noted in the [changelog](/CHANGELOG.md).

Version-specific migration steps live under [migration-guides/](migration-guides/).

> [!WARNING]
> After an update (even if non breaking), you MUST run the [migrations](#database-migrations) again. This is currently not handled automatically.
