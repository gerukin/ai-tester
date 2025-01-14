# Historical data

Tests, or prompts, which are no longer in your files are considered inactive (historical).

While new test and evaluation sessions are only run for active versions, historical data is preserved in the database. This means that if you change the config to remove a model, it will no longer be used for new tests and evaluations, but the old data will still be available.

Historical data is available for querying in the database only.

## Tags

What happens depends on whether the test or prompt is active or not.

When active, the tags associated with the test or prompt are updated to reflect the changes in the file(s).

When inactive, the tags are not updated. They are frozen in time (and can still be queried as they existed the last time the test / prompt was active).
