# Deployment Guide

## Prerequisites

- **Node.js**: v20 or later
- **PostgreSQL**: v14 or later (managed or self-hosted)
- **Vercel Account**: For deployment

## Required Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:password@host:5432/dbname` |
| `NEXT_TELEMETRY_DISABLED` | ❌ No | Disable Next.js telemetry | `1` |
| `CRON_SECRET` | ❌ Future | Secret for Vercel cron protection | `your-secret-here` |

## Deployment Steps (Vercel)

### 1. Connect Repository
1. Log in to [Vercel](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Configure project settings

### 2. Configure Environment Variables
In Vercel project settings → Environment Variables, add:
```
DATABASE_URL=postgresql://...
```

### 3. Deploy
1. Click "Deploy"
2. Vercel will automatically run `npm run build`
3. Migrations must be run separately (see below)

### 4. Run Database Migrations
After first deployment, run migrations:
```bash
# Set DATABASE_URL locally
npm run db:migrate
```

Or use Vercel CLI:
```bash
vercel env pull .env.local
npm run db:migrate
```

## Route Types

| Route | Type | Notes |
|-------|------|-------|
| `/` | Static | Dashboard homepage |
| `/import` | Static | Upload page |
| `/compare` | Dynamic | Server-rendered, accepts URL params |
| `/stocks/[symbol]` | Dynamic | Server-rendered, DB-backed |
| `/api/import/preview` | Dynamic | Route Handler |
| `/api/import/commit` | Dynamic | Route Handler |
| `/api/refresh/enrichment` | Dynamic | Manual refresh (graceful status) |

## Source Stability Notes

### External Data Sources
All external data sources are currently **parser-ready but live fetch is disabled**:

- **NSE Shareholding**: Parser implemented, fetch disabled (unofficial endpoints)
- **NSE Pledged Data**: Parser implemented, fetch disabled (unofficial endpoints)
- **NSE Insider Trading**: Parser implemented, fetch disabled (unofficial endpoints)
- **Yahoo Price Data**: Parser implemented, fetch disabled (unofficial/unstable)

All connectors return graceful failure status (`unavailable`) with clear warnings.

### Compare Mode Limitations
- Currently uses **placeholder data** (not live DB data)
- Full DB integration pending
- Limited to 10 symbols per comparison
- Symbols are deduplicated automatically

## Production Checklist

- [ ] `DATABASE_URL` is set in Vercel environment variables
- [ ] Database migrations have been run (`npm run db:migrate`)
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run build` completes successfully
- [ ] `npm test` passes (53 tests)
- [ ] Placeholder/compare data limitations documented
- [ ] External source instability noted in docs
- [ ] Vercel cron secret configured (if using cron jobs)

## Vercel Cron Integration (Future)

To enable periodic refresh of enrichment data:

1. Add `CRON_SECRET` to environment variables
2. Configure cron in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/refresh/enrichment",
    "schedule": "0 0 * * *"
  }]
}
```
3. The endpoint will return graceful status until live fetch is enabled

## Monitoring

- Check Vercel deployment logs for build/runtime errors
- Monitor database connections
- Review `/api/refresh/enrichment` responses for connector status
- All connector failures are graceful (no crashing)
