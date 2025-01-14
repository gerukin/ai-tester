---
tags:
  - lang_en
  - math
  - comparison
systemPrompts:
  - trade-info-bot-en
  - helpful-en

replacements:
  - comparison: |
      A: 0.5
      B: 0.4999
    answer: A (0.5)
  - comparison: |
      A: 780789120.23
      B: 780779120.24
    answer: A (780789120.23)
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
---

# 👤

Which is greater?

`{{comparison}}`

Output the letter corresponding to the greater number and explain why.

---

The candidate has to pick the greater number and explain why.

Choices were:

`{{comparison}}`

The answer should be `{{answer}}`! Either the letter or the number is enough. The explanation should make sense and support the conclusion.
