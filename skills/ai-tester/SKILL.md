---
name: ai-tester
description: Use when working in a project where ai-tester is installed, running ai-tester tests/evaluations/stats, syncing file-backed state, checking config-driven work, running migrations, or updating ai-tester.
---

# AI Tester

Use when working from the current project directory where `ai-tester` is installed.

Default to the `ai-tester` CLI. It is the supported interface for listing available values, sync, dry runs, test runs, evaluation runs, stats, migrations, and skill refreshes. Do not inspect or query the database directly unless the user explicitly asks for database inspection, the CLI reports a database problem that cannot be diagnosed from command output, or you are doing an ai-tester implementation/debugging task.

First locate the installed package root. Depending on the dependency name and package manager, it is usually one of:

- `node_modules/@gerukin/ai-tester/`
- `node_modules/ai-tester/`

Read the relevant reference for the task:

- Routine tool use, dry runs, sync, tests, evals, stats, config checks: [references/running.md](references/running.md)
- Dependency updates, migration checks, and post-update skill refresh: [references/updating.md](references/updating.md)

When behavior is unclear, read canonical docs from the installed package root:

- `README.md`
- `docs/README.md`
- `docs/config-file.md`
- `docs/tests-and-evaluations.md`
- `docs/models.md`
- `docs/environment-variables.md`
- `docs/migration-guides/`

Refresh this skill from the installed package with:

```sh
ai-tester skills sync
```

If `.agents/skills/ai-tester` already exists, interactive terminals ask before replacing it. Unattended runs fail unless `--replace` is set:

```sh
ai-tester skills sync --replace
```
