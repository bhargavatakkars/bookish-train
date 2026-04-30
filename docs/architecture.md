# Architecture

## Goals

- Import a Screener.in-exported XLSX and parse **only** the worksheet named `Data Sheet`.
- Preserve raw payloads for audit/debugging.
- Normalize data into a relational schema.
- Compute derived metrics with traceable provenance.
- Enrich missing data via fail-safe connector adapters.
- Deploy cleanly on Vercel (Next.js App Router + Route Handlers).

## High-Level Data Flow

1. **Upload** (client) → `POST /api/import/preview` (server)
2. **Parse** XLSX → extract raw `Data Sheet` matrix + sectioned parse output
3. **Preview** parse results client-side
4. **Commit** → `POST /api/import/commit` (server)
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

## Connector Architecture (Phase 7 + Phase 8)

### Overview
The connector framework provides a typed, modular way to enrich imported data with external sources, focusing initially on Indian listed-company ownership and governance data.

### Core Types (`src/lib/connectors/types.ts`)
- `ConnectorStatus`: Status of individual connector runs (`not_fetched`, `fetched`, `error`, `not_implemented`, `scaffolded`)
- `SourceStatus`: Overall source readiness (`planned`, `scaffolded`, `implemented`, `deprecated`)
- `SourceDescriptor`: Registry entry for each data source
- `RawSourceResult<T>`: Raw fetch result with metadata
- `NormalizedSourceResult<T>`: Normalized, typed output
- `ConnectorRunResult<T>`: Wrapper for connector execution results
- `EnrichmentEvidence`: Provenance metadata for enriched data
- `PricePoint`: Single price data point (date, close, open, high, low, volume)
- `PriceHistoryData`: Price history with quote and historical data

### Implemented Connectors (Phase 7 - Ownership & Governance)
1. **NSE Shareholding Pattern** (`nseShareholdingConnector.ts`)
   - Normalized shape: `ShareholdingData`
   - Fields: promoter_holding_pct, public_holding_pct, fii_fpi_pct, dii_pct, reporting_period
   - Status: **Implemented** (parser/normalizer ready, 11 tests, live fetch disabled)

2. **NSE Pledged Data** (`nsePledgedDataConnector.ts`)
   - Normalized shape: `PledgedData`
   - Fields: promoter_shares_encumbered_pct, pledged_shares_pct_of_promoter, pledged_shares_pct_of_total
   - Status: **Implemented** (parser/normalizer ready, 10 tests, live fetch disabled)

3. **NSE Insider Trading** (`nseInsiderTradingConnector.ts`)
   - Normalized shape: `InsiderTradingData`
   - Fields: transaction types, insider categories, buy/sell summaries
   - Status: **Implemented** (parser/normalizer ready, 10 tests, live fetch disabled)

### Implemented Connectors (Phase 8 - Price Enrichment)
4. **Price History** (`priceHistoryConnector.ts`)
   - Normalized shape: `PriceHistoryData`
   - Fields: current price, previous close, 52-week high/low, historical points
   - Status: **Implemented** (parser/normalizer ready, 9 tests, live fetch disabled)
   - Note: Uses Yahoo-style data (unofficial/unstable), aggressive graceful failure

### Source Registry (`registry.ts`)
Central catalog of all data sources with:
- Source metadata (name, URL, category)
- Implementation status
- Connector availability
- Notes on importance and implementation plan

### Presenter Layer (`src/lib/enrichment/ownershipGovernancePresenter.ts`)
- `buildOwnershipGovernanceSummary()`: Merges all connector outputs
- `calculateRiskSignals()`: Generates risk signals based on thresholds
- Computes overall confidence across connectors
- Generates reporting periods, warnings, notes

### UI Integration
- Stock detail page (`/stocks/[symbol]`) shows enrichment status section
- Displays connector types, implementation status, and planned sources
- Badge-based status indicators (scaffolded/planned/implemented)
- Price Enrichment section shows price data placeholders and warnings

## Compare Mode (Phase 9)

### Overview
Compare page allows side-by-side comparison of multiple stocks using URL query parameters.

### Key Components
1. **Compare Page** (`/compare?symbols=RELIANCE,TCS,INFY`)
   - Server-side rendering with Suspense
   - Compares key metrics: score, CAGR, margin, debt/equity, interest coverage, CFO/PAT
   - Shows ownership data (promoter, public, FII-FPI, DII percentages)
   - Displays warnings and coverage gaps
   - Limits to 10 symbols, deduplicates automatically

2. **Compare Query Layer** (`src/lib/queries/compare.ts`)
   - `parseSymbolsFromQuery()`: Parses URL query parameters
   - `getCompareData()`: Fetches and shapes data for multiple symbols
   - Returns `CompareViewModel` with stocks array, warnings, coverage gaps
   - Currently uses placeholder data (full DB integration pending)

3. **Refresh Endpoint** (`/api/refresh/enrichment`)
   - POST: Manual refresh for enrichment connectors
   - Returns graceful status (all connectors return 'unavailable' - live fetch disabled)
   - GET: Documentation and Vercel cron integration template
   - No background worker system yet

### Design Decisions
- No overbuilding: No market-data sync engine, no auth, no watchlists, no AI narratives
- Graceful failure: All connectors return 'unavailable' with proper warnings
- Prepared for future: Vercel cron template ready, connector architecture extensible

## Boundaries

- `src/lib/parser/*`: XLSX parsing, section detection, normalization utilities.
- `src/lib/metrics/*`: deterministic derived metrics.
- `src/lib/connectors/*`: enrichment adapters (fail-safe, typed).
- `src/lib/db/*`: Drizzle schema, db client, repositories.
- `src/app/api/*`: Route Handlers for parse/commit/read/enrich.
- `src/app/stocks/*`: dashboards (server components) + client widgets.

## Deployment (Vercel)

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `NEXT_TELEMETRY_DISABLED` | ❌ No | Disable Next.js telemetry |
| `CRON_SECRET` | ❌ Future | Secret for Vercel cron protection |

### Route Types
| Route | Type | Notes |
|-------|------|-------|
| `/` | Static | Dashboard homepage |
| `/import` | Static | Upload page |
| `/compare` | Dynamic | Server-rendered, accepts URL params |
| `/stocks/[symbol]` | Dynamic | Server-rendered, DB-backed |
| `/api/import/preview` | Dynamic | Route Handler |
| `/api/import/commit` | Dynamic | Route Handler |
| `/api/refresh/enrichment` | Dynamic | Manual refresh (graceful status) |

### Source Stability
All external sources are **parser-ready, live fetch disabled**:
- NSE Shareholding, Pledged, Insider Trading (unofficial endpoints)
- Yahoo Price Data (unofficial/unstable)

All connectors return graceful `unavailable` status with clear warnings.

### Production Checklist
- [ ] `DATABASE_URL` configured in Vercel
- [ ] Database migrations run (`npm run db:migrate`)
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (53 tests)
- [ ] Placeholder data limitations documented
- [ ] Vercel cron secret configured (if using cron)

## Migrations (Drizzle)

- Generate migrations: `npm run db:generate` (writes to `./drizzle`).
- Apply migrations (local/deploy): `npm run db:migrate` with `DATABASE_URL` set.
- Commit `./drizzle/*` to source control so Vercel deploys can run the same migration set.
