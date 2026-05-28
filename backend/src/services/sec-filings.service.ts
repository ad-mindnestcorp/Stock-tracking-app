/**
 * SEC EDGAR Filing Service
 * Extracts customer concentration data from 10-K and 10-Q filings.
 * Returns DATA_NOT_AVAILABLE if not disclosed in recent filings.
 */

import axios from 'axios';

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_USER_AGENT = 'StockTrackingApp/1.0 (research@example.com)'; // Update with your email

const CACHE_TTL_MS = 86400_000 * 7; // 7 days for SEC filing data

interface LocalCacheEntry { data: unknown; expiresAt: number }
const secCache = new Map<string, LocalCacheEntry>();

function getCached<T>(key: string): T | null {
  const e = secCache.get(key);
  if (e && Date.now() < e.expiresAt) return e.data as T;
  secCache.delete(key);
  return null;
}

function setCached(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
  secCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CustomerConcentrationData {
  symbol: string;
  concentrationPct: string | null; // e.g., "45% from top 3 customers"
  topCustomers: Array<{
    rank: string;
    revenuePct: string;
    trend: 'Rising' | 'Stable' | 'Falling' | 'Unknown';
  }>;
  source: string | null; // Filing type and date
  available: boolean;
}

interface SECFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  fileNumber: string;
  primaryDocument: string;
}

// ─── Helper: Get CIK from ticker ──────────────────────────────────────────────

async function getCIKFromTicker(ticker: string): Promise<string | null> {
  const key = `sec:cik:${ticker}`;
  const cached = getCached<string>(key);
  if (cached) return cached;

  try {
    // Use SEC Company Tickers JSON
    const res = await axios.get('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': SEC_USER_AGENT },
      timeout: 10000,
    });

    const companies = Object.values(res.data as Record<string, { ticker: string; cik_str: number }>);
    const match = companies.find(c => c.ticker.toUpperCase() === ticker.toUpperCase());

    if (match) {
      const cik = String(match.cik_str).padStart(10, '0');
      setCached(key, cik, CACHE_TTL_MS * 365); // Cache CIK for 1 year
      return cik;
    }

    return null;
  } catch (err) {
    console.warn(`[sec:cik] ${ticker} — ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ─── Helper: Get recent 10-K/10-Q filings ─────────────────────────────────────

async function getRecentFilings(cik: string, formType: '10-K' | '10-Q', limit = 2): Promise<SECFiling[]> {
  try {
    const res = await axios.get(`${SEC_BASE_URL}/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      timeout: 10000,
    });

    const filings = res.data?.filings?.recent;
    if (!filings) return [];

    const filtered: SECFiling[] = [];
    for (let i = 0; i < filings.form.length && filtered.length < limit; i++) {
      if (filings.form[i] === formType) {
        filtered.push({
          accessionNumber: filings.accessionNumber[i],
          filingDate: filings.filingDate[i],
          reportDate: filings.reportDate[i],
          form: filings.form[i],
          fileNumber: filings.fileNumber[i],
          primaryDocument: filings.primaryDocument[i],
        });
      }
    }

    return filtered;
  } catch (err) {
    console.warn(`[sec:filings] CIK ${cik} — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ─── Helper: Extract customer concentration from filing text ──────────────────

function extractCustomerConcentration(text: string): {
  found: boolean;
  concentrationPct: string | null;
  topCustomers: Array<{ rank: string; revenuePct: string; trend: 'Rising' | 'Stable' | 'Falling' | 'Unknown' }>;
} {
  const result = {
    found: false,
    concentrationPct: null as string | null,
    topCustomers: [] as Array<{ rank: string; revenuePct: string; trend: 'Rising' | 'Stable' | 'Falling' | 'Unknown' }>,
  };

  // Common patterns for customer concentration disclosure
  const patterns = [
    /(?:top|largest)\s+(\d+)\s+customers?\s+(?:accounted for|represented|comprised)\s+(?:approximately\s+)?(\d+)%/i,
    /(\d+)%\s+of\s+(?:total\s+)?(?:revenue|sales)\s+(?:was|were)\s+(?:from|derived from)\s+(?:the\s+)?(?:top|largest)\s+(\d+)\s+customers?/i,
    /customer\s+concentration[^.]*?(\d+)%/i,
    /significant\s+customer[^.]*?(\d+)%/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      result.found = true;
      const pct = match[1]?.match(/\d+/) ? match[1] : match[2];
      const customerCount = match[2]?.match(/\d+/) ? match[2] : match[1];
      
      if (pct) {
        result.concentrationPct = customerCount
          ? `${pct}% from top ${customerCount} customers`
          : `${pct}% customer concentration`;
        
        // Try to extract individual customer percentages
        const detailPattern = new RegExp(`customer\\s+[A-Z]\\s+(?:accounted for|represented)\\s+(?:approximately\\s+)?(\\d+)%`, 'gi');
        let detailMatch;
        let rank = 1;
        
        while ((detailMatch = detailPattern.exec(text)) !== null && rank <= 3) {
          result.topCustomers.push({
            rank: `#${rank}`,
            revenuePct: `${detailMatch[1]}%`,
            trend: 'Unknown',
          });
          rank++;
        }
      }
      
      break;
    }
  }

  return result;
}

// ─── Main: Get SEC Filing Status ──────────────────────────────────────────────

export interface SECFilingStatus {
  status: string;
  source: string | null;
}

const SEC_RISK_KEYWORDS = [
  { pattern: /dismissed/i, label: 'dismissed' },
  { pattern: /wells\s+notice/i, label: 'Wells Notice' },
  { pattern: /subpoena/i, label: 'subpoena' },
  { pattern: /enforcement\s+action/i, label: 'enforcement action' },
  { pattern: /SEC\s+investigation/i, label: 'SEC investigation' },
  { pattern: /securities\s+class\s+action/i, label: 'securities class action' },
];

export async function getSECFilingStatus(symbol: string): Promise<SECFilingStatus> {
  const key = `sec:filing_status:${symbol}`;
  const cached = getCached<SECFilingStatus>(key);
  if (cached) return cached;

  const base: SECFilingStatus = {
    status: 'No active SEC enforcement disclosed in recent 10-K',
    source: null,
  };

  try {
    const cik = await getCIKFromTicker(symbol);
    if (!cik) {
      setCached(key, base);
      return base;
    }

    const filings = await getRecentFilings(cik, '10-K', 1);
    if (!filings.length) {
      setCached(key, base);
      return base;
    }

    const filing = filings[0];
    const accessionNoFormatted = filing.accessionNumber.replace(/-/g, '');
    const docUrl = `${SEC_BASE_URL}/Archives/edgar/data/${cik}/${accessionNoFormatted}/${filing.primaryDocument}`;

    const docRes = await axios.get(docUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      timeout: 15000,
      maxContentLength: 10_000_000,
    });

    const text = docRes.data as string;

    // Search for risk factors section (~10000 chars)
    const lowerText = text.toLowerCase();
    const riskStart = lowerText.indexOf('risk factor');
    const searchExcerpt = riskStart !== -1
      ? text.substring(riskStart, riskStart + 10000)
      : text.substring(0, 10000);

    const source = `${filing.form} filed ${filing.filingDate}`;

    // Check dismissed first (takes priority — means past action resolved)
    if (SEC_RISK_KEYWORDS[0].pattern.test(searchExcerpt)) {
      const result: SECFilingStatus = {
        status: 'Previous SEC case dismissed (per 10-K risk factors)',
        source,
      };
      setCached(key, result);
      return result;
    }

    // Check remaining risk keywords
    const found = SEC_RISK_KEYWORDS.slice(1).find(k => k.pattern.test(searchExcerpt));
    if (found) {
      const result: SECFilingStatus = {
        status: `Active SEC enforcement disclosed in recent 10-K (${found.label})`,
        source,
      };
      setCached(key, result);
      return result;
    }

    const result: SECFilingStatus = { status: base.status, source };
    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[sec:filing_status] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Main: Get Customer Concentration ─────────────────────────────────────────

export async function getCustomerConcentration(symbol: string): Promise<CustomerConcentrationData> {
  const key = `sec:customer_concentration:${symbol}`;
  const cached = getCached<CustomerConcentrationData>(key);
  if (cached) return cached;

  const base: CustomerConcentrationData = {
    symbol,
    concentrationPct: null,
    topCustomers: [],
    source: null,
    available: false,
  };

  try {
    // Get CIK
    const cik = await getCIKFromTicker(symbol);
    if (!cik) {
      console.warn(`[sec:customer_concentration] ${symbol} — CIK not found`);
      setCached(key, base);
      return base;
    }

    // Get most recent 10-K (annual report has most complete disclosure)
    const filings = await getRecentFilings(cik, '10-K', 1);
    if (!filings.length) {
      console.warn(`[sec:customer_concentration] ${symbol} — no recent 10-K found`);
      setCached(key, base);
      return base;
    }

    const filing = filings[0];
    const accessionNoFormatted = filing.accessionNumber.replace(/-/g, '');

    // Fetch filing document
    const docUrl = `${SEC_BASE_URL}/Archives/edgar/data/${cik}/${accessionNoFormatted}/${filing.primaryDocument}`;
    const docRes = await axios.get(docUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      timeout: 15000,
      maxContentLength: 10_000_000, // Limit to 10MB
    });

    const filingText = docRes.data as string;

    // Look for customer concentration in common sections:
    // - "Risk Factors"
    // - "Management's Discussion and Analysis" (MD&A)
    // - "Business" section
    const searchText = filingText.toLowerCase();
    const concentrationStart = Math.max(
      searchText.indexOf('customer concentration'),
      searchText.indexOf('significant customer'),
      searchText.indexOf('major customer'),
    );

    if (concentrationStart === -1) {
      console.warn(`[sec:customer_concentration] ${symbol} — no customer concentration disclosure found in ${filing.form}`);
      setCached(key, base);
      return base;
    }

    // Extract 2000 characters around the keyword
    const excerpt = filingText.substring(concentrationStart, concentrationStart + 2000);
    const extracted = extractCustomerConcentration(excerpt);

    if (!extracted.found) {
      setCached(key, base);
      return base;
    }

    const result: CustomerConcentrationData = {
      symbol,
      concentrationPct: extracted.concentrationPct,
      topCustomers: extracted.topCustomers,
      source: `${filing.form} filed ${filing.filingDate}`,
      available: true,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[sec:customer_concentration] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}
