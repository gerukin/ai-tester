---
tags:
  # Language(s)
  - lang_instr_en

  # Category
  - documents

  # Sub category
  - data_extraction

systemPrompts:
  - document-extractor-en

structuredResponseSchema: invoice-schema

replacements:
  - document: <document path="`{{_file:0004-invoice-data-extraction/docs/batch1-0001.jpg}}`">invoice.jpg</document>
    invoiceNumber: 51109338
    invoiceDate: 2013-04-13
    dueDate: null
    billingEntity: Andrews, Kirby and Valdez
    billedEntity: Becker Ltd
    billedEntityAddress: 8012 Stewart Summit Apt. 455, North Douglas, AZ 95355
    subTotal: 5640.17
    taxAmount: 564.02
    totalAmount: 6204.19
    currency: USD
  - document: <document path="`{{_file:0004-invoice-data-extraction/docs/invoice_10248.pdf}}`">invoice.pdf</document>
    invoiceNumber: 10248
    invoiceDate: 2016-07-04
    dueDate: null
    billingEntity: null
    billedEntity: Paul Henriot
    billedEntityAddress: 59 rue de l'Abbaye, Reims, 51100, France
    subTotal: null
    taxAmount: null
    totalAmount: 440.0
    currency: EUR
  - document: <document path="`{{_file:0004-invoice-data-extraction/docs/invoice_10248.jpg}}`">invoice.jpg</document>
    invoiceNumber: 10248
    invoiceDate: 2016-07-04
    dueDate: null
    billingEntity: null
    billedEntity: Paul Henriot
    billedEntityAddress: 59 rue de l'Abbaye, Reims, 51100, France
    subTotal: null
    taxAmount: null
    totalAmount: 440.0
    currency: EUR
---

# 👤

Extract the information from the document below:

`{{document}}`

---

The AI candidate was supposed to extract data from an invoice document as a JSON object. The document actually contains the following information:

- **invoiceNumber**: `{{invoiceNumber}}`
- **invoiceDate**: `{{invoiceDate}}`
- **dueDate**: `{{dueDate}}`
- **billingEntity**: `{{billingEntity}}`
- **billedEntity**: `{{billedEntity}}`
- **billedEntityAddress**: `{{billedEntityAddress}}`
- **subTotal**: `{{subTotal}}`
- **taxAmount**: `{{taxAmount}}`
- **totalAmount**: `{{totalAmount}}`
- **currency**: `{{currency}}`

For any information marked as null above, the field should be either null or have been omitted from the JSON object. All values must match the above without any missing or extra information.

Note: allow inconsequential punctuation or stylistic mistakes, or variations which do not change the meaning of the value. For numeric values, leading and trailing zeros can be omitted or not.
