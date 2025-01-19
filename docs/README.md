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
5. Add some [SQL data](sql-data.md) to the DB for your supported models and cost data.

Then you can run the [migrations](#database-migrations).

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

> [!WARNING]
> After an update (even if non breaking), you MUST run the [migrations](#database-migrations) again. This is currently not handled automatically.
