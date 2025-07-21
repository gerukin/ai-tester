# Tests and Evaluations

A test file represents both a series of test messages and the evaluation instructions for those messages. The test messages are used to evaluate the performance of a model, and the evaluation instructions are used to determine whether the model's responses meet the requirements of the test.

> [!TIP]
> Make sure to read the [best practices](#best-practices).

## Format

You can see examples of prompts [here](./example/data/tests).

> [!NOTE]
> Markdown comments are not yet supported (they will be sent to the LLM - and it is not recommended to use them). They will be stripped out in a future version.

## Versioning

The test file and the evaluation instructions are versioned separately.

Each time you modify the test file, a new current version (or new current versions) is created. The system will use only this version for future runs. Past test sessions with former versions will not be affected.

> [!IMPORTANT]
> Using special tags in the frontmatter will trigger a new version, even if the text and replacements are unchanged.

When modifying the evaluation instructions, a new current version (or new current versions) is created. The system will use only this version for future runs. Past evaluations with former versions will not be affected. Any tests which used the old version will be re-evaluated with the new version in the next run.

## Tags

Tags can be added to any test file. They are used to filter in/out which tests are run based on the tags in the config file. They can also be used for analysis and statistics.

### Special tags

Special tags start with a `_` and are used to trigger specific actions in the system. As they are meaningful and influence how the test is run, they will trigger a new version each time they are added or removed.

- `_evaluator`: This indicates a prompt which can be used by evaluators.
- `_json_mode` (not yet supported, except with `_evaluator`): The result of the test or evaluation will be in JSON format.
- `_has_tools` (not yet supported)
- `_tools_only` (not yet supported)

## Replacements

Replacements can be used in tests and evaluations to provide dynamic content. They are used to replace placeholders in the prompt text with actual values.

### Simple pattern

Create 2 versions of the same prompt with different replacements:

```yaml
# other stuff in the frontmatter
replacements:
  question:
    - What have you been up to lately?
    - What's your favorite color?
```

```markdown
<!-- In the body -->

Question: `{{question}}`
```

Version 1:

```markdown
Question: What have you been up to lately?
```

Version 2:

```markdown
Question: What's your favorite color?
```

### Combined pattern

Create 4 versions of the same prompt with different replacements:

```yaml
# other stuff in the frontmatter
replacements:
  question:
    - What have you been up to lately?
    - What's your favorite color?
  name:
    - John
    - Lila
```

```markdown
<!-- In the body -->

Question: `{{question}}` - `{{name}}`
```

This will result in 4 versions for:

1. Question: What have you been up to lately? - John
2. Question: What have you been up to lately? - Lila
3. Question: What's your favorite color? - John
4. Question: What's your favorite color? - Lila

### Advanced pattern

To pair specific replacements, you can use nested lists:

```yaml
# other stuff in the frontmatter
replacements:
  - question: What is John's wife's profession?
    answer: Lawyer
  - question: Who is Julie's husband?
    answer: John
```

Each answer will be paired with the corresponding question (2 versions total).

More complex patterns are possible too:

```yaml
# other stuff in the frontmatter
- comparison: |
      A: 1,988,234.24
      B: 1,989,234.23
    answer: B (1,989,234.23)
  - comparison:
      - |
        A: 1,090.76
        B: 1090.76
      - |
        A: 1801090.76
        B: 1,801,090.76
    answer: that it is a tie (both are equal, just formatted differently)
```

Here we have 4 versions of the prompt. The last 2 share the same answer.

## Structured Response

You can add a structured response schema in the relevant directory and refer to it by id in the test file.

```yaml
structuredResponseSchema: my-schema-id
```

When doing so, the LLM will be forced to return a response that matches the schema.

> [!NOTE]
> The `structuredResponseSchema` field is not compatible with all LLMs (the LLM must officially support structured responses), and cannot be used at the same time as the `availableTools` field.

## Including file references

You can include file references in the test file. The files will be read and their content will be included in the test messages.

```markdown
<!-- In the body -->

Here is the content of the file:

Look at {{_file:path/relative/to/tests/dir/file.jpg}} and describe it.
```

The script will use sensible defaults for mime types based on the file extension but yours may not be supported. There is no way to override the mime type at the moment. It is passed using the LLM's native file handling capabilities, if any. Referencing files in LLMs which do not support file handling may result in an error or unexpected behavior. Use tags to filter out such tests if need be.

A new test version will be created if the referenced file changes (its content or its path).

## Tools

You can specify which tools are available to the LLM for a given test by listing them in the YAML frontmatter using the `availableTools` field. Each tool must be defined in the tool definitions directory.

Example:

```yaml
availableTools:
  - city-weather
  - my-custom-tool
```

When you specify tools in the test frontmatter, the LLM will be able to call these tools during the test. The tool definitions (parameters, description, etc.) are loaded from the tool definitions directory and versioned. If you change a tool definition, a new tool version will be created and linked to new test versions as appropriate.

The LLM will be given a choice to call any or several of the tools listed in the `availableTools` field, or even directly reply to the user. The tool choice is `automatic` and decided purely by the LLM. The calls themselves (or the response) are then returned as part of the response to evaluate for the test.

> [!IMPORTANT]
> A new test version will be created if the set of available tools or their versions changes.

You can reference tool parameters in the test body or evaluation instructions using the same replacement syntax as for other variables.

In the evaluation instructions, you can indicate what tool calls (if any) were expected from the LLM, and even specify the expected parameters for those calls. Ex::

```markdown
The AI candidate was expected to call the `cityWeather` tool with the following parameters:

- `cityName`: `{{cityName}}`
- `countryCode`: `{{countryCode}}`
```

If you want to test tool use, make sure to include the tool in `availableTools` and describe the expected tool call in the evaluation instructions.

> [!NOTE]
> The `availableTools` field is not compatible with all LLMs (the LLM must officially support tool calling), and cannot be used at the same time as the `structuredResponseSchema` field.

## Evaluation instructions

The evaluation instructions are found at the end of the test file, after the last `---` separator. They can include placeholders for replacements as well.

Evaluators will use these instructions to produce 2 things:

- Whether the AI candidate's response passes or fails the test.
- Some feedback in case of failure (sometimes even if the test passes - but normally it would be empty).

> [!NOTE]
> Evaluations are all or nothing right now. We may introduce the concept of scoring in the future.

## Best practices

Evaluators need proper guidance to evaluate the model's responses. Often, showing the expected answer is not enough, and it is better to provide some condensed context, the expected result, and if appropriate, the rationale. The model should then be told what criteria to use to pass/fail the candidate.
