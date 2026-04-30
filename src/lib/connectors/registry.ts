import { SourceDescriptor } from './types';

export const sourceRegistry: SourceDescriptor[] = [
  {
    id: 'nse-shareholding',
    source_name: 'NSE Shareholding Pattern',
    source_url: 'https://www.nseindia.com/companies-listing/corporate-filings-shareholding-pattern',
    category: 'ownership',
    description: 'Promoter, FII/FPI, DII, and public shareholding data from NSE',
    status: 'implemented',
    connector_available: true,
    notes: 'Parser/normalizer implemented and tested (11 tests). Live fetch pending stable NSE integration.'
  },
  {
    id: 'nse-pledged',
    source_name: 'NSE Pledged Data',
    source_url: 'https://www.nseindia.com/companies-listing/corporate-filings-pledged-shares',
    category: 'ownership',
    description: 'Promoter encumbrance and pledged share data from NSE',
    status: 'implemented',
    connector_available: true,
    notes: 'Parser/normalizer implemented and tested (10 tests). Live fetch pending stable NSE integration.'
  },
  {
    id: 'nse-insider-trading',
    source_name: 'NSE Insider Trading',
    source_url: 'https://www.nseindia.com/companies-listing/corporate-filings-insider-trading',
    category: 'governance',
    description: 'Insider trading disclosures from NSE',
    status: 'implemented',
    connector_available: true,
    notes: 'Parser/normalizer implemented and tested (10 tests). Live fetch pending stable NSE integration.'
  },
  {
    id: 'price-history',
    source_name: 'Price History (Yahoo Assumption)',
    source_url: 'https://finance.yahoo.com',
    category: 'price',
    description: 'Historical price data with current price, 52-week range, and historical points',
    status: 'implemented',
    connector_available: true,
    notes: 'Parser/normalizer implemented and tested (9 tests). Live fetch disabled: source is unofficial/unstable. Parser-ready only.'
  },
  {
    id: 'sebi-filings',
    source_name: 'SEBI Corporate Filings',
    source_url: 'https://www.sebi.gov.in/filings',
    category: 'corporate-filings',
    description: 'Regulatory filings and disclosures via SEBI',
    status: 'planned',
    connector_available: false,
    notes: 'Planned for future governance expansion. No connector implemented yet.'
  },
  {
    id: 'annual-reports',
    source_name: 'Annual Reports',
    source_url: '',
    category: 'governance',
    description: 'Company annual reports for governance and financial metadata',
    status: 'planned',
    connector_available: false,
    notes: 'Over-parsed in this phase per constraints. Planned for future phases.'
  },
  {
    id: 'manual-research',
    source_name: 'Manual Research',
    source_url: '',
    category: 'governance',
    description: 'Manually curated ownership/governance notes',
    status: 'planned',
    connector_available: false,
    notes: 'Fallback for data not available via automated connectors.'
  }
];
