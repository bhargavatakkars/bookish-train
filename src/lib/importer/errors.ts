export type ScreenerImportErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "DATA_SHEET_MISSING";

export class ScreenerImportError extends Error {
  public readonly code: ScreenerImportErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ScreenerImportErrorCode,
    message: string,
    opts?: { status?: number; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ScreenerImportError";
    this.code = code;
    this.status = opts?.status ?? 400;
    this.details = opts?.details;
  }
}

export function asScreenerImportError(error: unknown): ScreenerImportError {
  if (error instanceof ScreenerImportError) return error;
  if (error instanceof Error) {
    return new ScreenerImportError("INVALID_FILE_TYPE", error.message, {
      status: 400,
    });
  }
  return new ScreenerImportError("INVALID_FILE_TYPE", "Unknown error", {
    status: 400,
  });
}

