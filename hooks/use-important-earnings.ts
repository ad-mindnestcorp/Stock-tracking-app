import { useQuery } from '@tanstack/react-query';
import {
  fetchEarningsCalendar,
  fetchCompanyProfile,
  type CompanyProfile,
  type EarningsCalendarItem,
} from '@/lib/finnhub-direct';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

const ALLOWED_EXCHANGES = ['NASDAQ', 'NYSE'];
const MIN_MARKET_CAP_M = 2_000; // $2B in $M units
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfilesBatched(
  symbols: string[]
): Promise<Map<string, CompanyProfile>> {
  const result = new Map<string, CompanyProfile>();
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const profiles = await Promise.all(batch.map(fetchCompanyProfile));
    batch.forEach((sym, idx) => {
      const p = profiles[idx];
      if (p) result.set(sym, p);
    });
    if (i + BATCH_SIZE < symbols.length) await delay(BATCH_DELAY_MS);
  }
  return result;
}

export interface ImportantEarningsEntry {
  symbol: string;
  name: string;
  exchange: string;
  marketCapitalization: number;
  logo: string;
  date: string;
  hour: EarningsCalendarItem['hour'];
  epsEstimate: number | null;
  epsActual: number | null;
}

export interface ImportantEarningsData {
  today: ImportantEarningsEntry[];
  tomorrow: ImportantEarningsEntry[];
  nextSevenDays: ImportantEarningsEntry[];
}

function isAllowedExchange(exchange: string): boolean {
  return ALLOWED_EXCHANGES.some((ex) => exchange.toUpperCase().includes(ex));
}

function byMarketCapDesc(a: ImportantEarningsEntry, b: ImportantEarningsEntry): number {
  return b.marketCapitalization - a.marketCapitalization;
}

async function loadImportantEarnings(): Promise<ImportantEarningsData> {
  const today = new Date();
  const day7 = addDays(today, 7);
  const todayStr = formatYMD(today);
  const tomorrowStr = formatYMD(addDays(today, 1));
  const day2Str = formatYMD(addDays(today, 2));
  const day7Str = formatYMD(day7);

  const calendar = await fetchEarningsCalendar(todayStr, day7Str);

  const uniqueSymbols = [...new Set(calendar.map((e) => e.symbol))];
  const profileMap = await fetchProfilesBatched(uniqueSymbols);

  const entries: ImportantEarningsEntry[] = [];
  for (const item of calendar) {
    const profile = profileMap.get(item.symbol);
    if (!profile) continue;
    if (profile.marketCapitalization < MIN_MARKET_CAP_M) continue;
    if (!isAllowedExchange(profile.exchange)) continue;
    entries.push({
      symbol: item.symbol,
      name: profile.name,
      exchange: profile.exchange,
      marketCapitalization: profile.marketCapitalization,
      logo: profile.logo,
      date: item.date,
      hour: item.hour,
      epsEstimate: item.epsEstimate,
      epsActual: item.epsActual,
    });
  }

  const todayEntries = entries.filter((e) => e.date === todayStr).sort(byMarketCapDesc);
  const tomorrowEntries = entries.filter((e) => e.date === tomorrowStr).sort(byMarketCapDesc);
  const nextSevenEntries = entries
    .filter((e) => e.date >= day2Str && e.date <= day7Str)
    .sort(byMarketCapDesc);

  return { today: todayEntries, tomorrow: tomorrowEntries, nextSevenDays: nextSevenEntries };
}

export function useImportantEarnings() {
  return useQuery<ImportantEarningsData>({
    queryKey: ['important-earnings'],
    queryFn: loadImportantEarnings,
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
  });
}
