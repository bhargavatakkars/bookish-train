import {
  ShareholdingData,
  PledgedData,
  InsiderTradingData,
  EnrichmentEvidence
} from '@/lib/connectors/types';

export interface OwnershipGovernanceSummary {
  // Shareholding
  shareholding?: {
    promoter_pct: number | null;
    public_pct: number | null;
    fii_fpi_pct: number | null;
    dii_pct: number | null;
    reporting_period: string | null;
    trend_available: boolean;
  };
  
  // Pledged Data
  pledged?: {
    promoter_holding_pct: number | null;
    encumbered_pct: number | null;
    pledge_of_promoter_pct: number | null;
    pledge_of_total_pct: number | null;
    reporting_period: string | null;
  };
  
  // Insider Trading
  insider?: {
    transaction_type: string | null;
    insider_category: string | null;
    buy_summary_pct: number | null;
    sell_summary_pct: number | null;
    reporting_period: string | null;
  };
  
  // Aggregate
  overall_confidence: number;
  reporting_periods: string[];
  warnings: string[];
  notes: string[];
  is_parser_ready: boolean; // true if parsers are ready (even if fetch not available)
  is_live_fetch_available: boolean; // true if live NSE fetch is implemented
}

/**
 * Combine normalized outputs from all three ownership/governance connectors
 */
export function buildOwnershipGovernanceSummary(params: {
  shareholding?: ShareholdingData;
  pledged?: PledgedData;
  insider?: InsiderTradingData;
}): OwnershipGovernanceSummary {
  const warnings: string[] = [];
  const notes: string[] = [];
  const reporting_periods: string[] = [];

  // Process shareholding
  let shareholdingSummary = undefined;
  if (params.shareholding) {
    const sh = params.shareholding;
    shareholdingSummary = {
      promoter_pct: sh.promoter_holding_pct,
      public_pct: sh.public_holding_pct,
      fii_fpi_pct: sh.fii_fpi_pct,
      dii_pct: sh.dii_pct,
      reporting_period: sh.reporting_period,
      trend_available: sh.trend_history_available
    };
    
    if (sh.reporting_period) {
      reporting_periods.push(`Shareholding: ${sh.reporting_period}`);
    }
    if (sh.warnings) {
      warnings.push(...sh.warnings);
    }
    if (sh.evidence) {
      notes.push(`Shareholding: ${sh.evidence.source_name} (confidence: ${(sh.evidence.confidence * 100).toFixed(0)}%)`);
    }
  } else {
    notes.push('Shareholding: Parser ready, live fetch pending');
  }

  // Process pledged data
  let pledgedSummary = undefined;
  if (params.pledged) {
    const pl = params.pledged;
    pledgedSummary = {
      promoter_holding_pct: pl.total_promoter_holding_pct,
      encumbered_pct: pl.promoter_shares_encumbered_pct,
      pledge_of_promoter_pct: pl.pledged_shares_pct_of_promoter,
      pledge_of_total_pct: pl.pledged_shares_pct_of_total,
      reporting_period: pl.reporting_period
    };
    
    if (pl.reporting_period) {
      reporting_periods.push(`Pledged: ${pl.reporting_period}`);
    }
    if (pl.warnings) {
      warnings.push(...pl.warnings);
    }
    if (pl.evidence) {
      notes.push(`Pledged: ${pl.evidence.source_name} (confidence: ${(pl.evidence.confidence * 100).toFixed(0)}%)`);
    }
  } else {
    notes.push('Pledged: Parser ready, live fetch pending');
  }

  // Process insider trading
  let insiderSummary = undefined;
  if (params.insider) {
    const ins = params.insider;
    insiderSummary = {
      transaction_type: ins.transaction_type,
      insider_category: ins.insider_category,
      buy_summary_pct: ins.buy_summary_pct,
      sell_summary_pct: ins.sell_summary_pct,
      reporting_period: ins.reporting_period
    };
    
    if (ins.reporting_period) {
      reporting_periods.push(`Insider: ${ins.reporting_period}`);
    }
    if (ins.warnings) {
      warnings.push(...ins.warnings);
    }
    if (ins.evidence) {
      notes.push(`Insider: ${ins.evidence.source_name} (confidence: ${(ins.evidence.confidence * 100).toFixed(0)}%)`);
    }
  } else {
    notes.push('Insider: Parser ready, live fetch pending');
  }

  // Calculate overall confidence
  const confidences: number[] = [];
  if (params.shareholding?.evidence) {
    confidences.push(params.shareholding.evidence.confidence);
  }
  if (params.pledged?.evidence) {
    confidences.push(params.pledged.evidence.confidence);
  }
  if (params.insider?.evidence) {
    confidences.push(params.insider.evidence.confidence);
  }
  
  const overall_confidence = confidences.length > 0 
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
    : 0;

  return {
    shareholding: shareholdingSummary,
    pledged: pledgedSummary,
    insider: insiderSummary,
    overall_confidence: overall_confidence,
    reporting_periods,
    warnings,
    notes,
    is_parser_ready: true, // All three parsers are implemented
    is_live_fetch_available: false // Live fetch is gracefully disabled
  };
}

/**
 * Calculate risk signals based on ownership/governance data
 */
export function calculateRiskSignals(summary: OwnershipGovernanceSummary): Array<{
  type: 'pledge' | 'insider' | 'concentration';
  severity: 'low' | 'medium' | 'high';
  message: string;
}> {
  const risks: Array<{
    type: 'pledge' | 'insider' | 'concentration';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }> = [];

  // Pledge risk
  if (summary.pledged) {
    const pledge_pct = summary.pledged.pledge_of_promoter_pct;
    if (pledge_pct !== null) {
      if (pledge_pct > 50) {
        risks.push({
          type: 'pledge',
          severity: 'high',
          message: `High promoter pledge: ${pledge_pct.toFixed(1)}% of holding pledged`
        });
      } else if (pledge_pct > 25) {
        risks.push({
          type: 'pledge',
          severity: 'medium',
          message: `Moderate promoter pledge: ${pledge_pct.toFixed(1)}% of holding pledged`
        });
      } else if (pledge_pct > 0) {
        risks.push({
          type: 'pledge',
          severity: 'low',
          message: `Low promoter pledge: ${pledge_pct.toFixed(1)}% of holding pledged`
        });
      }
    }
  }

  // Insider activity risk
  if (summary.insider) {
    const buy_pct = summary.insider.buy_summary_pct;
    const sell_pct = summary.insider.sell_summary_pct;
    
    if (buy_pct !== null && sell_pct !== null) {
      const total_activity = buy_pct + sell_pct;
      if (total_activity > 5) {
        risks.push({
          type: 'insider',
          severity: 'medium',
          message: `Elevated insider activity: ${(buy_pct + sell_pct).toFixed(1)}% of shares traded`
        });
      }
    }
  }

  // Promoter concentration risk
  if (summary.shareholding) {
    const promoter_pct = summary.shareholding.promoter_pct;
    if (promoter_pct !== null && promoter_pct > 75) {
      risks.push({
        type: 'concentration',
        severity: 'medium',
        message: `High promoter concentration: ${promoter_pct.toFixed(1)}% holding`
      });
    }
  }

  return risks;
}
