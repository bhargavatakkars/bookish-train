import { Suspense } from 'react';
import { parseSymbolsFromQuery } from '@/lib/queries/compare';
import type { Metadata } from 'next';

interface ComparePageProps {
  searchParams: Promise<{ symbols?: string | string[] }>;
}

export async function generateMetadata({
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const params = await searchParams;
  const symbols = parseSymbolsFromQuery(params.symbols);
  let title = 'Compare Stocks | Bookish Train';
  if (symbols.length > 0) {
    title = 'Compare ' + symbols.join(', ') + ' | Bookish Train';
  }
  return { title };
}

function CompareTableSkeleton() {
  return (
    <div className='animate-pulse'>
      <div className='h-8 bg-gray-200 rounded w-48 mb-4'></div>
      <div className='space-y-3'>
        {[1, 2, 3].map((i) => (
          <div key={i} className='h-16 bg-gray-100 rounded'></div>
        ))}
      </div>
    </div>
  );
}

interface DisplayStock {
  symbol: string;
  name: string | null;
  score: number | null;
  revenueCagr: string | null;
  profitCagr: string | null;
  netMargin: string | null;
  debtEquity: string | null;
  interestCover: string | null;
  cfoPat: string | null;
  promoterPct: string | null;
  fiiPct: string | null;
  diiPct: string | null;
  publicPct: string | null;
  warnings: string[];
}

async function getCompareData(symbols: string[]): Promise<DisplayStock[]> {
  return symbols.map((symbol) => ({
    symbol,
    name: null,
    score: null,
    revenueCagr: null,
    profitCagr: null,
    netMargin: null,
    debtEquity: null,
    interestCover: null,
    cfoPat: null,
    promoterPct: null,
    fiiPct: null,
    diiPct: null,
    publicPct: null,
    warnings: ['Full implementation would fetch from DB'],
  }));
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const symbols = parseSymbolsFromQuery(params.symbols);

  if (symbols.length === 0) {
    return (
      <main className='mx-auto max-w-6xl px-4 py-8'>
        <h1 className='mb-6 text-2xl font-bold'>Compare Stocks</h1>
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-6'>
          <div className='flex items-start gap-3'>
            <div className='text-2xl'>📊</div>
            <div>
              <h3 className='mb-2 font-medium text-amber-900'>No Symbols Provided</h3>
              <p className='mb-3 text-sm text-amber-800'>
                Add stock symbols to the URL to compare them side by side.
              </p>
              <div className='rounded bg-amber-100 p-3 text-xs text-amber-700'>
                <p className='mb-1 font-medium'>Example:</p>
                <code className='block'>?symbols=RELIANCE,TCS,INFY</code>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (symbols.length > 10) {
    return (
      <main className='mx-auto max-w-6xl px-4 py-8'>
        <h1 className='mb-6 text-2xl font-bold'>Compare Stocks</h1>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6'>
          <div className='flex items-start gap-3'>
            <div className='text-2xl'>⚠️</div>
            <div>
              <h3 className='mb-2 font-medium text-red-900'>Too Many Symbols</h3>
              <p className='mb-2 text-sm text-red-800'>
                Maximum 10 symbols allowed per comparison. You provided {symbols.length}.
              </p>
              <p className='text-xs text-red-600'>
                Symbols entered: {symbols.join(', ')}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const stocks = await getCompareData(symbols);

  // Check if using placeholder data
  const isPlaceholderData = stocks.some(s => s.warnings.some(w => w.includes('Full implementation') || w.includes('not fully implemented')));

  return (
    <main className='mx-auto max-w-6xl px-4 py-8'>
      <h1 className='mb-6 text-2xl font-bold'>
        Compare Stocks: {symbols.join(', ')}
      </h1>

      {isPlaceholderData && (
        <div className='mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <div className='flex items-start gap-3'>
            <div className='text-2xl'>ℹ️</div>
            <div>
              <h3 className='mb-1 font-medium text-blue-900'>Demo Mode</h3>
              <p className='text-sm text-blue-800'>
                Compare page is currently using placeholder data. Full database integration is pending.
              </p>
            </div>
          </div>
        </div>
      )}

      {symbols.length !== [...new Set(symbols)].length && (
        <div className='mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4'>
          <div className='flex items-start gap-3'>
            <div className='text-2xl'>⚠️</div>
            <div>
              <h3 className='mb-1 font-medium text-amber-900'>Duplicate Symbols Detected</h3>
              <p className='text-sm text-amber-800'>
                Duplicate symbols were automatically removed. Showing {[...new Set(symbols)].length} unique symbols.
              </p>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<CompareTableSkeleton />}>
        <div className='overflow-x-auto rounded-lg border'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                  Metric
                </th>
                {stocks.map((stock) => (
                  <th
                    key={stock.symbol}
                    className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'
                  >
                    {stock.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 bg-white'>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Score
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.score !== null ? (
                      <span className={'rounded px-2 py-0.5 text-xs font-medium ' + (
                        stock.score >= 70 ? 'bg-green-100 text-green-800' :
                        stock.score >= 40 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      )}>
                        {stock.score}
                      </span>
                    ) : (
                      <span className='text-gray-400'>—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Revenue CAGR (3Y)
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.revenueCagr || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Net Profit CAGR (3Y)
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.profitCagr || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Net Margin
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.netMargin || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Debt/Equity
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.debtEquity || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Interest Coverage
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.interestCover || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  CFO/PAT
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.cfoPat || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Promoter %
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.promoterPct || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  FII/FPI %
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.fiiPct || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  DII %
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.diiPct || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                  Public %
                </td>
                {stocks.map((stock) => (
                  <td key={stock.symbol} className='whitespace-nowrap px-4 py-3 text-sm text-gray-500'>
                    {stock.publicPct || '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {stocks.some(s => s.warnings.length > 0) && (
          <div className='mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4'>
            <h3 className='mb-2 text-sm font-medium text-amber-800'>Data Notes</h3>
            <ul className='list-disc space-y-1 pl-5 text-sm text-amber-700'>
              {stocks.flatMap(s => s.warnings.map((w, i) => (
                <li key={s.symbol + '-' + i}>{s.symbol}: {w}</li>
              )))}
            </ul>
          </div>
        )}
      </Suspense>
    </main>
  );
}
