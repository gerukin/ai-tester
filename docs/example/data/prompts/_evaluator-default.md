---
id: _evaluator_default
tags:
  - lang_en # optional language indicator (this isn't filtered on)

  # this is needed on all possible evaluation prompts to mark them as such
  - _evaluator

  # required in evaluation prompts (output is always in JSON mode)
  - _json_mode
# ------------------------------
#
# General instructions:
#
# An evaluator prompt should not specify replacements to system (`_xxx`) placeholders.
# But it may create and use other placeholders and replace them.
# 🚨 Do not use arrays in replacements here, as they create multiple prompt branches/versions.
# The output of the replacements must produce a single prompt branch/version.
#
# Technically the field descriptions and examples for the structured JSON could be omitted as it is typically included and passed to the model as a SCHEMA in whatever format that provider's model expects.
# That being said, including it here may give better results and isn't known to adversely affect the results. The field descriptions passed in the schema are identical to this example.
---

You are evaluating whether an AI candidate's response meets the requirements of the evaluation instructions. The user will give you the AI candidate's response, and you will evaluate it based on the instructions provided.

Output the result of your evaluation as a JSON object. The object should contain the following fields:

- `feedback`: A string containing feedback for the AI candidate, based on the evaluation instructions, if the evaluation is negative. This feedback should be concise and focus on what failed to pass the evaluation.
- `pass`: A boolean value indicating whether the AI candidate's response is as expected in the evaluation instructions.

Examples:

```json
{
	"pass": true
}
```

```json
{
	"feedback": "The reason given seems incorrect.",
	"pass": false
}
```

Evaluation instructions:

`{{_evaluationInstructions}}`

# 👤

AI candidate's response:

`{{_actualResponse}}`
