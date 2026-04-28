"use client";

import UploadClient from "./uploadClient";

export default function ImportPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Import
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upload a Screener XLSX and commit the parsed data.
        </p>
      </div>

      <UploadClient />
    </div>
  );
}

