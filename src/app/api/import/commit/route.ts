import { NextResponse } from "next/server";

import {
  asScreenerImportError,
  ScreenerImportError,
} from "@/lib/importer/errors";
import {
  extractImportMetaSnapshot,
  normalizeParsedSections,
} from "@/lib/importer/normalize";
import { ensureCompany, persistImport } from "@/lib/importer/persist";
import { parseScreenerDataSheetXlsx } from "@/lib/importer/screenerDataSheetParser";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function isValidXlsxMime(type: string): boolean {
  // Accept common XLSX MIME types
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/vnd.ms-excel",
    "application/xlsx"
  ];
  return validTypes.includes(type);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const symbol = formData.get("symbol");

    if (!(symbol === null || typeof symbol === "string")) {
      throw new ScreenerImportError("INVALID_FILE_TYPE", "Invalid symbol", {
        status: 400,
      });
    }

    const effectiveSymbol = symbol?.trim();
    if (!effectiveSymbol) {
      throw new ScreenerImportError(
        "INVALID_FILE_TYPE",
        "Missing field 'symbol'",
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      throw new ScreenerImportError(
        "INVALID_FILE_TYPE",
        "Missing upload field 'file'",
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ScreenerImportError(
        "FILE_TOO_LARGE",
        `File too large (max ${MAX_UPLOAD_BYTES} bytes)`,
        { status: 413, details: { size: file.size } },
      );
    }

    // More permissive check: if MIME type is provided and looks like Excel, accept it
    // If MIME type is empty or unknown, we'll still try to parse the file
    if (file.type && !isValidXlsxMime(file.type)) {
      console.warn(`Warning: Unexpected MIME type "${file.type}" for file "${file.name}". Attempting to parse anyway.`);
      // Don't throw error - let the parser handle invalid files
      // throw new ScreenerImportError(
      //   "INVALID_FILE_TYPE",
      //   `Invalid file type: ${file.type}`,
      //   { status: 415 },
      // );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseScreenerDataSheetXlsx(buffer);
    const normalized = normalizeParsedSections(parsed.parsedSections);
    const meta = extractImportMetaSnapshot(parsed.parsedSections);

    const company = await ensureCompany({ symbol: effectiveSymbol });
    const { importId } = await persistImport({
      companyId: company.id,
      originalFileName: file.name,
      parsed,
      normalized,
      meta,
    });

    return NextResponse.json({ ok: true, importId });
  } catch (error) {
    const typed = asScreenerImportError(error);
    return NextResponse.json(
      { ok: false, error: { code: typed.code, message: typed.message, details: typed.details } },
      { status: typed.status },
    );
  }
}
