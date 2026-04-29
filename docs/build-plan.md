# Build Plan (Single Source of Truth)

This file tracks progress, blockers, and next actions. Update **before and after** each major implementation block.

## Phase 1 — Import + Parse + Persist + First Dashboard

- [x] Scaffold Next.js App Router + Tailwind + baseline lint/build
- [x] Ensure builds work without external Google Font fetches
- [x] Add mandatory documentation set (this, architecture, parser spec, source connectors)
- [x] Add PostgreSQL + Drizzle ORM schema
- [x] Generate + commit Drizzle migrations
- [x] Implement Screener XLSX parsing (ONLY `Data Sheet`) using SheetJS
- [x] Normalize parsed sections into typed statement tables
- [x] Persist raw import payload + normalized tables + parser logs
- [x] Build import UX: upload -> parse preview -> commit
- [x] Build DB-backed dashboard (`/`) + `/stocks/[symbol]` detail (coverage + trends)
- [x] Normalize META/PRICE/DERIVED fields (price, mcap, shares) and improve dashboard health

## Phase 2 — Metrics + Scoring + Missing Data Intelligence

- [x] Generate + commit initial Drizzle migrations
- [x] Deterministic metrics engine (CAGR, ratios, coverage reasons) (imported-only)
- [x] Quality scoring framework (section scores + confidence) (imported-only)
- [x] Missing-data panel (present vs missing + suggested free sources) (imported-only)
- [ ] Expand imported-only analytics (Milestone 2 in progress)
- [ ] Trend charts (Recharts or ECharts)

## Phase 3 — Ownership + Governance Enrichment Connectors

- [ ] Connector framework (typed adapters + source logs + raw payload storage)
- [ ] NSE shareholding connector (promoter/pledge/FII/DII)
- [ ] Annual report / filings connector
- [ ] Ownership + governance pages

## Phase 4 — Price Enrichment + Compare + Refresh

- [ ] Price history connector (Yahoo-style assumptions; fail-safe)
- [ ] Compare page (multi-company grid)
- [ ] Cron readiness (optional Vercel cron endpoints)
- [ ] Caching/perf passes

## Phase 5 — Tests + Polish + Deployment

- [ ] Tests: parser detection, metrics, API validation, duplicate import
- [ ] Error handling + observability review
- [ ] Vercel deploy config (env vars, DB migrations)

## Blockers / Notes

- Dashboard now reads from DB and links to `/stocks/[symbol]`.
- Detail pages currently map a small set of metric keys (sales, net_profit, borrowings, cash_from_operating_activity, cash_equivalents).
- META/DERIVED values are stored on `companies`/`imports`; annual PRICE points are stored in `import_annual_prices`.
- `npm run build` disables Next.js telemetry via `NEXT_TELEMETRY_DISABLED=1`.

## Assumptions

- Use Drizzle + Postgres as primary persistence.
- Imports are server-side processed via Route Handlers.
