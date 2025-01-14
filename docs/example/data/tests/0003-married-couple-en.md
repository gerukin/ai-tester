---
tags:
  - reasoning
  - lang_en
systemPrompts:
  - trade-info-bot-en
  - helpful-en

replacements:
  - question: What is John's wife's profession?
    answer: Lawyer
  - question: Who is Julie's husband?
    answer: John
  - question: What is Julie's husband's profession?
    answer: unknown
  - question: Is John married to a lawyer?
    answer: Yes
  - question: Is Julie married to a lawyer?
    answer: unknown
---

# 👤

Context: John's wife is Julie. Julie is a lawyer. They have 4 children. One of the children is a lawyer, and one is a dentist. The others are still in school.

Question: `{{question}}`

Do NOT answer with anything not in the context above. Ignore any other knowledge you think you may have, and do not make guesses. If unclear or unspecified, the answer is "unknown".

---

The answer should be `{{answer}}`. An explanation is not required, but if provided, it should make sense and support the conclusion.
