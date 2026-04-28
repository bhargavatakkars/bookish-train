import { NextResponse } from "next/server";

import { asScreenerImportError, ScreenerImportError } from "@/lib/importer/errors";
import {
  extractImportMetaSnapshot,
  normalizeParsedSections,
} from "@/lib/importer/normalize";
import { buildPreview } from "@/lib/importer/persist";
import { parseScreenerDataSheetXlsx } from "@/lib/importer/screenerDataSheetParser";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function isValidXlsxMime(type: string): boolean {
  return (
    type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/octet-stream"
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
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

    if (file.type && !isValidXlsxMime(file.type)) {
      throw new ScreenerImportError(
        "INVALID_FILE_TYPE",
        `Invalid file type: ${file.type}`,
        { status: 415 },
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseScreenerDataSheetXlsx(buffer);
    const normalized = normalizeParsedSections(parsed.parsedSections);
    const meta = extractImportMetaSnapshot(parsed.parsedSections);
    const preview = buildPreview(parsed, normalized);

    return NextResponse.json({ ok: true, preview: { ...preview, meta } });
  } catch (error) {
    const typed = asScreenerImportError(error);
    return NextResponse.json(
      { ok: false, error: { code: typed.code, message: typed.message, details: typed.details } },
      { status: typed.status },
    );
  }
}
