# Build Plan (Single Source of Truth)

This file tracks progress, blockers, and next actions. Update **before and after** each major implementation block.

## Phase 1 — Import + Parse + Persist + First Dashboard

- [x] Scaffold Next.js App Router + Tailwind + baseline lint/build
- [x] Ensure builds work without external Google Font fetches
- [ ] Add mandatory documentation set (this, architecture, parser spec, source connectors)
- [ ] Add PostgreSQL + Drizzle ORM schema + migrations
- [ ] Implement Screener XLSX parsing (ONLY `Data Sheet`) using SheetJS
- [ ] Normalize parsed sections into typed statement tables
- [ ] Persist raw import payload + normalized tables + parser logs
- [ ] Build import UX: upload -> parse preview -> commit
- [ ] Build initial `/stocks/[symbol]` dashboard (coverage + trends)

## Phase 2 — Metrics + Scoring + Missing Data Intelligence

- [ ] Deterministic metrics engine (CAGR, ratios, coverage reasons)
- [ ] Quality scoring framework (section scores + confidence)
- [ ] Missing-data panel (present vs missing + suggested free sources)
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

- None yet.

## Assumptions

- Use Drizzle + Postgres as primary persistence.
- Imports are server-side processed via Route Handlers.

