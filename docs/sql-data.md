# Manual SQL data

Manual SQL is useful for data that is intentionally outside the file-backed registries, such as:

- private analysis tables or views
- custom one-off data fixes
- schema-related SQL that belongs with your own migration workflow rather than the app's file-backed registries

Currency exchange rates no longer need bespoke SQL when `AI_TESTER_CURRENCIES_DIR` is configured. If you do not enable the currency registry yet, legacy DB-managed rates still work.

> [!TIP]
> If you add your own tables or views, prefer prefixes such as `_` or `priv_` to avoid future naming conflicts.

See the [example SQL files](./example/data/sql) for legacy/manual examples only.
