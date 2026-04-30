import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/refresh/enrichment
 * 
 * Lightweight manual refresh endpoint for enrichment connectors.
 * - Manual invocation only (no background jobs yet)
 * - Returns graceful status
 * - Safe failure handling
 * - Prepared for future Vercel cron integration
 * 
 * Future: Add CRON_SECRET header validation for cron protection
 */

interface RefreshRequest {
  symbol?: string;
  connectors?: string[]; // e.g., ['shareholding', 'pledged', 'insider-trading', 'price-history']
}

interface RefreshResult {
  symbol: string;
  connector: string;
  status: 'not_fetched' | 'unavailable' | 'success' | 'error';
  message: string;
  confidence?: number;
}

interface RefreshResponse {
  success: boolean;
  results: RefreshResult[];
  warnings: string[];
  notes: string[];
  timestamp: string;
}

// Optional: CRON_SECRET for future cron protection
// Add to environment variables: CRON_SECRET=your-secure-secret
function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // No secret configured = open access (safe for manual use)
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  
  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token === cronSecret;
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const warnings: string[] = [];
  const results: RefreshResult[] = [];
  const notes: string[] = [
    "Manual refresh endpoint (Phase 9)",
    "Connectors are parser-ready; live fetch is disabled for unstable sources.",
    "Prepared for future Vercel cron integration (not implemented yet).",
  ];

  try {
    // Optional: Validate cron secret if configured
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          warnings: ["Unauthorized: Invalid or missing authorization token"],
          notes,
          timestamp,
        } as RefreshResponse,
        { status: 401 }
      );
    }

    let body: RefreshRequest;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    
    const symbol = body.symbol?.trim().toUpperCase();
    const connectors = body.connectors || ['shareholding', 'pledged', 'insider-trading', 'price-history'];

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          warnings: ["No symbol provided"],
          notes,
          timestamp,
        } as RefreshResponse,
        { status: 400 }
      );
    }

    // Verify stock exists in DB
    const db = getDb();
    const stock = await db
      .select({ id: companies.id, symbol: companies.symbol })
      .from(companies)
      .where(eq(companies.symbol, symbol))
      .limit(1);

    if (stock.length === 0) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          warnings: [`Stock ${symbol} not found in database`],
          notes,
          timestamp,
        } as RefreshResponse,
        { status: 404 }
      );
    }

    // Simulate refresh for each connector (graceful - all return unavailable)
    for (const connectorName of connectors) {
      switch (connectorName) {
        case 'shareholding':
          results.push({
            symbol,
            connector: 'nse-shareholding',
            status: 'unavailable' as const,
            message: 'Live fetch disabled: NSE source unstable. Parser/normalizer ready.',
            confidence: 0,
          });
          break;

        case 'pledged':
          results.push({
            symbol,
            connector: 'nse-pledged',
            status: 'unavailable' as const,
            message: 'Live fetch disabled: NSE source unstable. Parser/normalizer ready.',
            confidence: 0,
          });
          break;

        case 'insider-trading':
          results.push({
            symbol,
            connector: 'nse-insider-trading',
            status: 'unavailable' as const,
            message: 'Live fetch disabled: NSE source unstable. Parser/normalizer ready.',
            confidence: 0,
          });
          break;

        case 'price-history':
          results.push({
            symbol,
            connector: 'price-history',
            status: 'unavailable' as const,
            message: 'Live fetch disabled: Yahoo-style source unofficial/unstable. Parser/normalizer ready.',
            confidence: 0,
          });
          break;

        default:
          warnings.push(`Unknown connector: ${connectorName}`);
      }
    }

    // Add note about cron readiness
    notes.push("To integrate with Vercel cron: set up a cron job that POSTs to this endpoint with { symbol: '...', connectors: [...] }");
    notes.push("Optional: Set CRON_SECRET env var and pass 'Authorization: Bearer <secret>' header for protection");

    return NextResponse.json({
      success: true,
      results,
      warnings,
      notes,
      timestamp,
    } as RefreshResponse);

  } catch (error) {
    console.error('Refresh endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        results: [],
        warnings: [`Internal error: ${error instanceof Error ? error.message : String(error)}`],
        notes,
        timestamp,
      } as RefreshResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/refresh/enrichment
 * Returns endpoint documentation (no action taken)
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  
  return NextResponse.json({
    endpoint: '/api/refresh/enrichment',
    method: 'POST',
    description: 'Manual refresh for enrichment connectors',
    status: 'ready',
    liveFetchEnabled: false,
    timestamp,
    notes: [
      "All connectors are parser-ready but live fetch is disabled.",
      "Sources are unofficial/unstable (NSE, Yahoo-style).",
      "Prepared for Vercel cron integration (not implemented yet).",
    ],
    exampleBody: {
      symbol: 'RELIANCE',
      connectors: ['shareholding', 'pledged', 'insider-trading', 'price-history'],
    },
    cronIntegration: {
      vercelJson: {
        crons: [
          {
            path: '/api/refresh/enrichment',
            method: 'POST',
            schedule: '0 0 * * *', // Daily at midnight
            body: {
              symbol: 'RELIANCE',
              connectors: ['shareholding', 'pledged', 'insider-trading'],
            },
          },
        ],
      },
      note: 'Vercel cron execution not implemented yet. This is a readiness template.',
      auth: 'Optional: Set CRON_SECRET env var and pass "Authorization: Bearer <secret>" header',
    },
  });
}
