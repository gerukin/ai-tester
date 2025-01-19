# Manual SQL data

You will need to manually update parts of the database to insert missing data referenced in your configuration file, or which cannot (or is not) maintained by this package directly.

> [!TIP]
> You can also create your own extra tables and views to store additional data, or to help with analysis.
>
> If you do this, we recommend you prefix your tables and views with `_` or `priv_` to avoid conflicts with future versions of this package. Those namespace prefixes will never be used by this package.

Data which needs to be manually inserted includes:

- [ ] [Providers](config-file.md#providers)
- [ ] [Models](config-file.md#models)
- [ ] [Model versions](config-file.md#model-versions)
- [ ] Model version costs and currencies

Refer to the [example files](./example/data/sql) for more information on how to insert the data.
