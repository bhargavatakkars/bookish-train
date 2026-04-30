"use client";

import { useMemo, useState } from "react";

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type ImportPreview = {
  parserVersion: string;
  importChecksum: string;
  warnings: Array<{ code: string; message: string }>;
  meta?: {
    companyName: string | null;
    currentPrice: string | null;
    marketCap: string | null;
    faceValue: string | null;
    shares: string | null;
    sharesAdjCr: string | null;
  };
  workbookMeta: { sheetNames: string[]; dataSheetName: "Data Sheet" };
  sectionKeys: string[];
  counts: {
    profitLossAnnual: number;
    profitLossQuarterly: number;
    balanceSheet: number;
    cashFlow: number;
  };
};

function isValidXlsxMime(type: string): boolean {
  return (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/octet-stream"
  );
}

export default function UploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);

  const canPreview = file !== null && loading === null;
  const canCommit = file !== null && symbol.trim().length > 0 && loading === null;

  const warningText = useMemo(() => {
    if (!preview || preview.warnings.length === 0) return null;
    return preview.warnings.map((w) => `${w.code}: ${w.message}`).join("\n");
  }, [preview]);

  function validateFile(file: File): ApiError | null {
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return { code: "INVALID_FILE_TYPE", message: "File must be an XLSX file (.xlsx extension)" };
    }
    
    // Check MIME type
    if (file.type && !isValidXlsxMime(file.type)) {
      return { code: "INVALID_FILE_TYPE", message: `Invalid file type: ${file.type}. Expected XLSX.` };
    }
    
    // Check file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { code: "FILE_TOO_LARGE", message: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max 10MB.` };
    }
    
    return null;
  }

  async function runPreview() {
    if (!file) return;
    
    // Validate file before upload
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
    setImportId(null);
    setPreview(null);
    setLoading("preview");

    try {
      const body = new FormData();
      body.set("file", file);

      const res = await fetch("/api/import/preview", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as
        | { ok: true; preview: ImportPreview }
        | { ok: false; error: ApiError };

      if (!res.ok || !json.ok) {
        setError(
          json.ok ? { code: "UNKNOWN", message: "Preview failed" } : json.error,
        );
        return;
      }

      setPreview(json.preview);
    } catch (e) {
      setError({ code: "NETWORK", message: String(e) });
    } finally {
      setLoading(null);
    }
  }

  // Handle successful commit with redirect
  async function handleCommitSuccess(importId: string, symbol: string) {
    setImportId(importId);
    // Short delay to show success state before redirect
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.href = `/stocks/${encodeURIComponent(symbol)}`;
  }

  async function runCommit() {
    if (!file) return;
    
    // Validate file before upload
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
    setImportId(null);
    setLoading("commit");

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("symbol", symbol.trim());

      const res = await fetch("/api/import/commit", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as
        | { ok: true; importId: string }
        | { ok: false; error: ApiError };

      if (!res.ok || !json.ok) {
        setError(
          json.ok ? { code: "UNKNOWN", message: "Commit failed" } : json.error,
        );
        return;
      }

      // Handle success with redirect
      await handleCommitSuccess(json.importId, symbol.trim());
    } catch (e) {
      setError({ code: "NETWORK", message: String(e) });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          XLSX file
        </span>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setImportId(null);
            setError(null);
          }}
          className="block w-full text-sm"
        />
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!canPreview}
          onClick={runPreview}
          className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading === "preview" ? "Parsing..." : "Parse Preview"}
        </button>
      </div>

      {preview ? (
        <div className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-zinc-500">Parser</div>
            <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {preview.parserVersion}
            </div>
            <div className="text-zinc-500">Checksum</div>
            <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {preview.importChecksum.slice(0, 16)}…
            </div>
            <div className="text-zinc-500">Sheets</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.workbookMeta.sheetNames.join(", ")}
            </div>
            <div className="text-zinc-500">Company name</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.meta?.companyName ?? "—"}
            </div>
            <div className="text-zinc-500">Current price</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.meta?.currentPrice ?? "—"}
            </div>
            <div className="text-zinc-500">Market cap</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.meta?.marketCap ?? "—"}
            </div>
            <div className="text-zinc-500">Sections</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.sectionKeys.join(", ") || "(none)"}
            </div>
            <div className="text-zinc-500">Annual P&amp;L rows</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.counts.profitLossAnnual}
            </div>
            <div className="text-zinc-500">Quarterly P&amp;L rows</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.counts.profitLossQuarterly}
            </div>
            <div className="text-zinc-500">Balance Sheet rows</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.counts.balanceSheet}
            </div>
            <div className="text-zinc-500">Cash Flow rows</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {preview.counts.cashFlow}
            </div>
          </div>

          {warningText ? (
            <pre className="mt-4 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {warningText}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Company symbol
          </span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. TCS"
            className="h-10 rounded-md border border-zinc-200 px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <button
          type="button"
          disabled={!canCommit}
          onClick={runCommit}
          className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "commit" ? "Saving..." : "Commit Import"}
        </button>
        {importId ? (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            <div className="font-medium">Import successful!</div>
            <div className="mt-1">Import ID: <span className="font-mono text-xs">{importId}</span></div>
            <div className="mt-2">
              Redirecting to <a href={`/stocks/${encodeURIComponent(symbol.trim())}`} className="underline font-medium">/stocks/{symbol.trim()}</a>...
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          <div className="font-medium">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}
    </div>
  );
}
