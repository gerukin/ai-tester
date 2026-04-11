# Updating AI Tester

Use this reference only when the task is actually to update `ai-tester`.

## Workflow

1. Inspect `package.json` to confirm the dependency key and package manager. The recommended GitHub dependency form may use `@gerukin/ai-tester` with `github:gerukin/ai-tester#semver:...`.
2. Update the dependency with the package manager already used by the project.
3. Refresh this local skill from the newly installed package:

   ```sh
   ai-tester skills sync --replace
   ```

4. Re-read this skill if it changed.
5. Check `CHANGELOG.md` and `docs/migration-guides/` from the installed package root.
6. Run migrations:

   ```sh
   ai-tester migrate
   ```

7. Use dry runs to check whether the update or config changes created new test/evaluation work.

Prefer existing package scripts for update or migration commands when the project defines them.
