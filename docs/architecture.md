# Architecture

## Goals

- Import a Screener.in-exported XLSX and parse **only** the worksheet named `Data Sheet`.
- Preserve raw payloads for audit/debugging.
- Normalize data into a relational schema.
- Compute derived metrics with traceable provenance.
- Enrich missing data via fail-safe connector adapters.
- Deploy cleanly on Vercel (Next.js App Router + Route Handlers).

## High-Level Data Flow

1. **Upload** (client) → `POST /api/imports/parse` (server)
2. **Parse** XLSX → extract raw `Data Sheet` matrix + sectioned parse output
3. **Preview** parse results client-side
4. **Commit** → `POST /api/imports/commit` (server)
5. **Persist**
   - raw import payload (metadata + matrix)
   - parser logs/warnings
   - normalized statement tables
6. **Analyze**
   - derived metrics engine (deterministic)
   - quality scoring engine
7. **Enrich**
   - connector framework pulls from free/public sources
   - raw payload + normalized items persisted with source provenance
8. **Read UI** (server components) from Postgres for dashboards

## Boundaries

- `src/lib/parser/*`: XLSX parsing, section detection, normalization utilities.
- `src/lib/metrics/*`: deterministic derived metrics.
- `src/lib/connectors/*`: enrichment adapters (fail-safe, typed).
- `src/lib/db/*`: Drizzle schema, db client, repositories.
- `src/app/api/*`: Route Handlers for parse/commit/read/enrich.
- `src/app/stocks/*`: dashboards (server components) + client widgets.

## Deployment Notes (Vercel)

- Route Handlers run in serverless/edge contexts; keep parsing server-side, but avoid huge memory spikes.
- Use Postgres hosted externally (e.g., Neon/Supabase/managed Postgres).
- Store large raw XLSX binary payloads only if needed; prefer storing extracted `Data Sheet` matrix + workbook metadata.

