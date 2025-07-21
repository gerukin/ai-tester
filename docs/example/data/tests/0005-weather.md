---
tags:
  # Language(s)
  - lang_instr_en

  # Category
  - tool-use

  # Sub category
  - single-tool

systemPrompts:
  - obedient-expert-en

availableTools:
  - city-weather

replacements:
  - cityName: Paris
    countryHint: I live in France.
    countryCode: FR (it MUST be specified, and other calls for other country codes are not allowed)
  - cityName: Paris
    countryHint: ''
    countryCode: "It's ok to omit the country parameter or set it to null here. Multiple calls with different countries or without a country are also allowed, but at least one call must either have `FR` as the country code, or omit the country parameter!"
  - cityName: Paris
    countryHint: I live in Texas.
    countryCode: US (it MUST be specified, and other calls for other country codes are not allowed)
---

# 👤

What's the weather like in `{{cityName}}`?
`{{countryHint}}`

---

The AI candidate MUST have called the `cityWeather` tool, with the following arguments:

- `cityName`: `{{cityName}}`
- `countryCode`: `{{countryCode}}`
