# Screener `Data Sheet` Parser Spec

## Non-Negotiables

- Parse **only** the worksheet named `Data Sheet`.
- Prefer **label-based** section detection; avoid fixed row numbers.
- Preserve raw extracted matrix and unknown row labels.
- Never crash on missing sections; emit warnings and continue.

## Input

- XLSX file exported from Screener.in.
- Only the `Data Sheet` worksheet is considered.

## Output Artifacts

1. `workbookMeta`: sheet names, basic metadata, checksum.
2. `dataSheetMatrix`: 2D array of cell values (strings/numbers/booleans/null).
3. `sections`: detected blocks such as `META`, `PROFIT LOSS`, `QUARTERS`, `BALANCE SHEET`, `CASH FLOW`, `PRICE`, `DERIVED`.
4. `normalized`: canonical statement tables (annual/quartely P&L, balance sheet, cash flow, price points).
5. `warnings`: array of parse warnings and reasons.

## Detection Strategy

- Convert the worksheet into a dense 2D matrix using SheetJS.
- Trim trailing empty rows/cols.
- Scan the first column (and near-first columns) for **section header labels**.
- For each section, treat the first row after the header as the **period/date header row**.
- Read subsequent rows until the next section header (or end).
- Preserve unknown metric labels as-is.

## Normalization Rules

- Empty cells → `null`.
- Numeric strings (with commas) → number.
- Percent values remain numbers (no `%`) if detectable.
- Date-like headers parsed into ISO `YYYY-MM-DD` where possible.
- All numeric normalization must be deterministic and unit-safe.

## Error Handling

- If `Data Sheet` is missing: return a typed error payload.
- If a section is missing: append warning and continue.
- If a row is malformed: append warning with row index + label.

