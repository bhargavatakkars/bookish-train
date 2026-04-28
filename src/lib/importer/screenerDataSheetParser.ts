import "server-only";

import crypto from "node:crypto";
import type { WorkSheet, WorkBook } from "xlsx";
import * as XLSX from "xlsx";

import { ScreenerImportError } from "./errors";

export const SCREENER_PARSER_VERSION = "screener-data-sheet/v1";

export type ParserWarningCode =
  | "SECTION_MISSING"
  | "SECTION_EMPTY"
  | "ROW_MALFORMED"
  | "UNKNOWN";

export type ParserWarning = {
  code: ParserWarningCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ScreenerDataSheetSectionKey =
  | "META"
  | "PROFIT_LOSS"
  | "QUARTERS"
  | "BALANCE_SHEET"
  | "CASH_FLOW"
  | "PRICE"
  | "DERIVED";

export type ParsedSectionTable = {
  headerRowIndex: number;
  periodHeaders: string[];
  rows: Array<{ label: string; values: Array<string | number | boolean | null> }>;
};

export type ScreenerParsedSections = Partial<
  Record<ScreenerDataSheetSectionKey, ParsedSectionTable>
 >;

export type ParsedDataSheet = {
  workbookMeta: {
    sheetNames: string[];
    dataSheetName: "Data Sheet";
  };
  dataSheetMatrix: Array<Array<string | number | boolean | null>>;
  parsedSections: ScreenerParsedSections;
  warnings: ParserWarning[];
  importChecksum: string;
};

const SECTION_LABELS: Array<{ key: ScreenerDataSheetSectionKey; label: string }> =
  [
    { key: "META", label: "META" },
    { key: "PROFIT_LOSS", label: "PROFIT LOSS" },
    { key: "QUARTERS", label: "QUARTERS" },
    { key: "BALANCE_SHEET", label: "BALANCE SHEET" },
    { key: "CASH_FLOW", label: "CASH FLOW" },
    { key: "PRICE", label: "PRICE" },
    { key: "DERIVED", label: "DERIVED" },
  ];

function normalizeCell(cell: unknown): string | number | boolean | null {
  if (cell === undefined || cell === null) return null;
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell === "boolean") return cell;
  return String(cell);
}

function toDenseMatrix(sheet: WorkSheet): Array<Array<string | number | boolean | null>> {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[];

  const rows = matrix.map((row) =>
    Array.isArray(row) ? row.map(normalizeCell) : [],
  );

  let maxCols = 0;
  for (const row of rows) maxCols = Math.max(maxCols, row.length);
  const padded = rows.map((row) => {
    const next = row.slice();
    while (next.length < maxCols) next.push(null);
    return next;
  });

  return trimEmptyEdges(padded);
}

function isRowEmpty(row: Array<string | number | boolean | null>): boolean {
  return row.every((cell) => cell === null);
}

function isColEmpty(
  matrix: Array<Array<string | number | boolean | null>>,
  colIndex: number,
): boolean {
  return matrix.every((row) => row[colIndex] === null);
}

function trimEmptyEdges(
  matrix: Array<Array<string | number | boolean | null>>,
): Array<Array<string | number | boolean | null>> {
  let top = 0;
  while (top < matrix.length && isRowEmpty(matrix[top]!)) top++;
  let bottom = matrix.length - 1;
  while (bottom >= top && isRowEmpty(matrix[bottom]!)) bottom--;

  const sliced = matrix.slice(top, bottom + 1);
  if (sliced.length === 0) return [];

  let left = 0;
  while (left < sliced[0]!.length && isColEmpty(sliced, left)) left++;
  let right = sliced[0]!.length - 1;
  while (right >= left && isColEmpty(sliced, right)) right--;

  return sliced.map((row) => row.slice(left, right + 1));
}

function cellAsUpperLabel(value: string | number | boolean | null): string {
  if (value === null) return "";
  return String(value).trim().toUpperCase();
}

function computeChecksum(buffer: ArrayBuffer): string {
  const hash = crypto.createHash("sha256");
  hash.update(Buffer.from(buffer));
  return hash.digest("hex");
}

function findSectionHeaderRows(
  matrix: Array<Array<string | number | boolean | null>>,
): Array<{ key: ScreenerDataSheetSectionKey; rowIndex: number }>
{
  const hits: Array<{ key: ScreenerDataSheetSectionKey; rowIndex: number }> = [];

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex]!;

    const candidates = [row[0], row[1], row[2]]
      .map(cellAsUpperLabel)
      .filter(Boolean);
    if (candidates.length === 0) continue;

    for (const { key, label } of SECTION_LABELS) {
      if (candidates.includes(label)) {
        hits.push({ key, rowIndex });
        break;
      }
    }
  }

  hits.sort((a, b) => a.rowIndex - b.rowIndex);
  const deduped: typeof hits = [];
  for (const hit of hits) {
    if (deduped.some((d) => d.key === hit.key)) continue;
    deduped.push(hit);
  }
  return deduped;
}

function parseSection(
  key: ScreenerDataSheetSectionKey,
  matrix: Array<Array<string | number | boolean | null>>,
  headerRowIndex: number,
  sectionEndRowExclusive: number,
  warnings: ParserWarning[],
): ParsedSectionTable | undefined {
  const sectionHeaderRow = headerRowIndex;
  const tableHeaderRow = headerRowIndex + 1;
  if (tableHeaderRow >= sectionEndRowExclusive) {
    warnings.push({
      code: "SECTION_EMPTY",
      message: `Section ${key} has no rows`,
      details: { headerRowIndex: sectionHeaderRow },
    });
    return undefined;
  }

  const headerRow = matrix[tableHeaderRow] ?? [];
  const periodHeaders = headerRow
    .slice(1)
    .map((c) => (c === null ? "" : String(c)))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const rows: ParsedSectionTable["rows"] = [];
  for (let rowIndex = tableHeaderRow + 1; rowIndex < sectionEndRowExclusive; rowIndex++) {
    const row = matrix[rowIndex]!;
    if (isRowEmpty(row)) continue;

    const labelCell = row[0];
    const label = labelCell === null ? "" : String(labelCell).trim();
    if (!label) {
      warnings.push({
        code: "ROW_MALFORMED",
        message: `Row missing label in ${key}`,
        details: { rowIndex },
      });
      continue;
    }
    rows.push({ label, values: row.slice(1) });
  }

  return {
    headerRowIndex: tableHeaderRow,
    periodHeaders,
    rows,
  };
}

export function parseScreenerDataSheetXlsx(buffer: ArrayBuffer): ParsedDataSheet {
  const importChecksum = computeChecksum(buffer);
  const workbook: WorkBook = XLSX.read(buffer, { type: "array" });

  const sheetNames = workbook.SheetNames.slice();
  const sheetName = sheetNames.find((name) => name === "Data Sheet");
  if (!sheetName) {
    throw new ScreenerImportError(
      "DATA_SHEET_MISSING",
      'Worksheet named "Data Sheet" is missing from the workbook.',
      { status: 422, details: { sheetNames } },
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const dataSheetMatrix = sheet ? toDenseMatrix(sheet) : [];
  const warnings: ParserWarning[] = [];

  const sectionHeaders = findSectionHeaderRows(dataSheetMatrix);
  const parsedSections: ScreenerParsedSections = {};

  for (const { key, rowIndex } of sectionHeaders) {
    const nextHeader = sectionHeaders.find((h) => h.rowIndex > rowIndex);
    const endExclusive = nextHeader ? nextHeader.rowIndex : dataSheetMatrix.length;
    const section = parseSection(
      key,
      dataSheetMatrix,
      rowIndex,
      endExclusive,
      warnings,
    );
    if (section) parsedSections[key] = section;
  }

  for (const { key } of SECTION_LABELS) {
    if (!parsedSections[key]) {
      warnings.push({
        code: "SECTION_MISSING",
        message: `Section ${key} not found`,
        details: { expectedLabel: key },
      });
    }
  }

  return {
    workbookMeta: {
      sheetNames,
      dataSheetName: "Data Sheet",
    },
    dataSheetMatrix,
    parsedSections,
    warnings,
    importChecksum,
  };
}

