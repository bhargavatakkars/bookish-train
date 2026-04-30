import { describe, it, expect } from "vitest";

// Import the module under test"
import {
  buildImportedMetricsSnapshot,
} from "./importedMetrics";

// Helper to create a MetricPoint"
function mp(date: string, value: number | null): { date: string; value: number | null } {
  return { date, value };
}

// ─── buildImportedMetricsSnapshot ───────────────────────────────────
describe("buildImportedMetricsSnapshot", () => {
  const baseSeries = {
    sales: [mp("2021", 900), mp("2022", 1000), mp("2023", 1100), mp("2024", 1200)],
    netProfit: [mp("2021", 90), mp("2022", 100), mp("2023", 110), mp("2024", 120)],
    borrowings: [mp("2021", 450), mp("2022", 500), mp("2023", 550), mp("2024", 600)],
    netWorth: [mp("2021", 750), mp("2022", 800), mp("2023", 850), mp("2024", 900)],
    cfo: [mp("2021", 80), mp("2022", 90), mp("2023", 95), mp("2024", 100)],
    cashBalance: [mp("2021", 40), mp("2022", 50), mp("2023", 60), mp("2024", 70)],
    ebit: [mp("2021", 140), mp("2022", 150), mp("2023", 160), mp("2024", 170)],
    interest: [mp("2021", 28), mp("2022", 30), mp("2023", 32), mp("2024", 34)],
    dividends: [mp("2021", 18), mp("2022", 20), mp("2023", 22), mp("2024", 24)],
    quarterlySales: undefined,
    quarterlyNetProfit: undefined,
  };

  const baseCoverage = {
    availableMetricKeys: ["sales", "net_profit"],
    missingMetricKeys: [],
    pointsByMetricKey: {
      sales: { total: 3, nonNull: 3 },
      net_profit: { total: 3, nonNull: 3 },
    },
  };

  it("returns a snapshot with metrics", () => {
    const snapshot = buildImportedMetricsSnapshot({
      series: baseSeries,
      coverage: baseCoverage,
    });
    expect(snapshot.metrics.length).toBeGreaterThan(0);
    expect(snapshot.scorecards).toBeDefined();
  });

  it("includes revenue CAGR metrics", () => {
    const snapshot = buildImportedMetricsSnapshot({
      series: baseSeries,
      coverage: baseCoverage,
    });
    const cagr3y = snapshot.metrics.find((m) => m.key === "revenue_cagr_3y");
    expect(cagr3y).toBeDefined();
    expect(cagr3y?.status).toBe("ok");
  });

  it("handles partial series (missing cashflow)", () => {
    const series = {
      ...baseSeries,
      cfo: [],
    };
    const snapshot = buildImportedMetricsSnapshot({
      series,
      coverage: baseCoverage,
    });
    const cfoToPat = snapshot.metrics.find((m) => m.key === "cfo_to_pat");
    expect(cfoToPat?.status).toBe("unavailable");
  });

  it("handles empty series", () => {
    const series = {
      sales: [],
      netProfit: [],
      borrowings: [],
      netWorth: [],
      cfo: [],
      cashBalance: [],
      ebit: [],
      interest: [],
      dividends: [],
      quarterlySales: undefined,
      quarterlyNetProfit: undefined,
    };
    const snapshot = buildImportedMetricsSnapshot({
      series,
      coverage: {
        availableMetricKeys: [],
        missingMetricKeys: ["sales", "net_profit"],
        pointsByMetricKey: {},
      },
    });
    expect(snapshot.metrics.length).toBeGreaterThan(0);
    // Most metrics should be unavailable
    const unavailable = snapshot.metrics.filter((m) => m.status === "unavailable");
    expect(unavailable.length).toBeGreaterThan(0);
  });

  it("computes overallScore as weighted average", () => {
    const snapshot = buildImportedMetricsSnapshot({
      series: baseSeries,
      coverage: baseCoverage,
    });
    expect(snapshot.overallScore).toBeDefined();
    expect(snapshot.overallScore).toBeGreaterThan(0);
    expect(snapshot.overallScore).toBeLessThanOrEqual(100);
  });
});
