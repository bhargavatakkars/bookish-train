# Source Connectors

This app enriches missing Screener `Data Sheet` items with free/public sources where feasible. Every connector must:

- return typed normalized output
- include raw payload for audit
- include `source_name`, `source_url`, `fetched_at`, `confidence_level`, `status`
- fail safely (never corrupt existing data)

## Planned Connectors

### `nseShareholdingConnector`

- Fetches promoter holding, pledge, FII/DII trend where available.
- Risk: HTML structure changes; must degrade gracefully.

### `nseAnnualReportConnector`

- Fetches annual report / filings links.
- Risk: link rot and inconsistent filings structure.

### `yfinancePriceConnector`

- Fetches long-term price history.
- Risk: rate limiting / API changes; should be cached and optional.

### `manualResearchConnector`

- Allows user-entered notes: concalls, management commentary, risks, moat.

