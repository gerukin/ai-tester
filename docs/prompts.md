# Prompts

A prompt is a file representing a system prompt, which can be applied to a candidate or evaluator model.

## Format

You can see examples of prompts [here](./example/data/prompts).

The only required key is the `id` in the frontmatter area, which uniquely identifies the prompt.

### Candidate

Example [here](./example/data/prompts/helpful-en.md).

### Evaluator

Example [here](./example/data/prompts/_evaluator-default.md).

> [!WARNING]
> Currently, you must have a single evaluator prompt with the `id: _evaluator_default` key, in your prompts directory.

## General rules

You must provide the entry point for your prompts directory in your [environment variables](environment-variables.md). Every markdown file in the directory will be considered a prompt, even if nested.

The file name is not considered important (and can be changed), and each `id` must be unique. The prompt text can be changed at any time, and the system will create a new version of it in the database, and use only this version for future runs. Past runs with former versions will not be affected.

Tags can be added/removed in the file, and are synchronized with all versions of the prompt in the DB.

Prompts can use replacements, see [tests](tests-and-evaluations.md#replacements), and follow the same rules (which can lead to multiple current versions at once).
