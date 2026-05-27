/**
 * Deterministic competitor mappings.
 * GPT must NEVER auto-discover competitors — use this map to prevent hallucinated peer data.
 * Add new symbols as needed; sector fallbacks apply when a specific mapping is absent.
 */

export const COMPETITOR_MAP: Record<string, string[]> = {
  // ─── Technology — Mega Cap ────────────────────────────────────────────────
  AAPL:  ['MSFT', 'GOOGL', 'META'],
  MSFT:  ['AAPL', 'GOOGL', 'AMZN'],
  GOOGL: ['MSFT', 'META', 'AMZN'],
  GOOG:  ['MSFT', 'META', 'AMZN'],
  META:  ['GOOGL', 'SNAP', 'PINS'],
  AMZN:  ['MSFT', 'GOOGL', 'WMT'],

  // ─── Technology — Semiconductors ─────────────────────────────────────────
  NVDA:  ['AMD', 'AVGO', 'INTC'],
  AMD:   ['NVDA', 'INTC', 'QCOM'],
  INTC:  ['AMD', 'NVDA', 'QCOM'],
  AVGO:  ['NVDA', 'QCOM', 'MRVL'],
  QCOM:  ['AMD', 'AVGO', 'MRVL'],
  MRVL:  ['AVGO', 'QCOM', 'INTC'],
  MU:    ['WDC', 'NVDA', 'INTC'],
  WDC:   ['MU', 'NVDA', 'INTC'],
  TXN:   ['ADI', 'MCHP', 'NXPI'],
  ADI:   ['TXN', 'MCHP', 'NXPI'],
  MCHP:  ['TXN', 'ADI', 'NXPI'],

  // ─── Technology — Cloud / Hyperscaler ────────────────────────────────────
  SNOW:  ['PLTR', 'DDOG', 'MDB'],
  DDOG:  ['SNOW', 'SPLK', 'DYMT'],
  MDB:   ['SNOW', 'ORCL', 'ESTC'],
  PLTR:  ['IBM', 'SNOW', 'PATH'],

  // ─── Technology — SaaS ────────────────────────────────────────────────────
  CRM:   ['SAP', 'NOW', 'ORCL'],
  NOW:   ['CRM', 'WDAY', 'SMAR'],
  WDAY:  ['CRM', 'NOW', 'SAP'],
  ORCL:  ['MSFT', 'SAP', 'IBM'],
  SAP:   ['ORCL', 'CRM', 'WDAY'],
  HUBS:  ['CRM', 'GOOGL', 'ADBE'],
  ADBE:  ['MSFT', 'CRM', 'ORCL'],
  INTU:  ['MSFT', 'ADBE', 'CRM'],
  SMAR:  ['NOW', 'ASANA', 'MNDY'],
  MNDY:  ['SMAR', 'ASANA', 'NOW'],

  // ─── Technology — Cybersecurity ───────────────────────────────────────────
  CRWD:  ['PANW', 'FTNT', 'S'],
  PANW:  ['CRWD', 'FTNT', 'ZS'],
  FTNT:  ['PANW', 'CRWD', 'ZS'],
  ZS:    ['PANW', 'CRWD', 'FTNT'],
  S:     ['CRWD', 'PANW', 'FTNT'],
  OKTA:  ['MSFT', 'PING', 'CRWD'],

  // ─── Technology — AI / Data ───────────────────────────────────────────────
  AI:    ['PLTR', 'CRM', 'IBM'],
  PATH:  ['PLTR', 'MSFT', 'IBM'],

  // ─── Technology — Internet / Social ──────────────────────────────────────
  NFLX:  ['DIS', 'PARA', 'WBD'],
  SNAP:  ['META', 'PINS', 'TWTR'],
  PINS:  ['META', 'SNAP', 'GOOGL'],
  LYFT:  ['UBER', 'DASH', 'BKNG'],
  UBER:  ['LYFT', 'DASH', 'BKNG'],
  DASH:  ['UBER', 'LYFT', 'GRUB'],
  BKNG:  ['EXPE', 'ABNB', 'TRVL'],
  ABNB:  ['BKNG', 'EXPE', 'VRBO'],
  EXPE:  ['BKNG', 'ABNB', 'TRVL'],
  EBAY:  ['AMZN', 'ETSY', 'WMT'],
  ETSY:  ['EBAY', 'AMZN', 'SHOP'],
  SHOP:  ['AMZN', 'ETSY', 'BIGC'],

  // ─── Fintech / Payments ───────────────────────────────────────────────────
  V:     ['MA', 'AXP', 'PYPL'],
  MA:    ['V', 'AXP', 'PYPL'],
  AXP:   ['V', 'MA', 'DFS'],
  PYPL:  ['V', 'MA', 'SQ'],
  SQ:    ['PYPL', 'V', 'MA'],
  AFRM:  ['SQ', 'PYPL', 'BNPL'],
  SOFI:  ['PYPL', 'UPST', 'LDI'],
  UPST:  ['SOFI', 'LC', 'AFRM'],

  // ─── Electric Vehicles / Auto ─────────────────────────────────────────────
  TSLA:  ['GM', 'F', 'RIVN'],
  RIVN:  ['TSLA', 'LCID', 'GM'],
  LCID:  ['RIVN', 'TSLA', 'GM'],
  GM:    ['F', 'TSLA', 'RIVN'],
  F:     ['GM', 'TSLA', 'STLA'],

  // ─── Energy / Clean Energy ────────────────────────────────────────────────
  ENPH:  ['SEDG', 'FSLR', 'RUN'],
  SEDG:  ['ENPH', 'FSLR', 'RUN'],
  FSLR:  ['ENPH', 'JKS', 'CSIQ'],
  FLNC:  ['STEM', 'ENPH', 'BE'],
  STEM:  ['FLNC', 'ENPH', 'BE'],
  BE:    ['PLUG', 'BLDP', 'FCEL'],
  PLUG:  ['BE', 'BLDP', 'FCEL'],
  NEE:   ['DUK', 'SO', 'D'],
  XOM:   ['CVX', 'COP', 'BP'],
  CVX:   ['XOM', 'COP', 'SLB'],

  // ─── Healthcare ───────────────────────────────────────────────────────────
  JNJ:   ['PFE', 'MRK', 'ABBV'],
  PFE:   ['JNJ', 'MRK', 'ABBV'],
  MRK:   ['PFE', 'JNJ', 'ABBV'],
  LLY:   ['ABBV', 'MRK', 'BMY'],
  ABBV:  ['LLY', 'JNJ', 'BMY'],
  BMY:   ['PFE', 'ABBV', 'MRK'],
  GILD:  ['ABBV', 'BMY', 'BIIB'],
  BIIB:  ['GILD', 'LLY', 'AMGN'],
  AMGN:  ['GILD', 'BIIB', 'ABBV'],
  ISRG:  ['MDT', 'SYK', 'BSX'],
  MDT:   ['ISRG', 'SYK', 'BSX'],
  UNH:   ['CI', 'ELV', 'HUM'],

  // ─── Retail / Consumer ────────────────────────────────────────────────────
  WMT:   ['TGT', 'COST', 'AMZN'],
  TGT:   ['WMT', 'COST', 'AMZN'],
  COST:  ['WMT', 'TGT', 'BJ'],
  HD:    ['LOW', 'WMT', 'TGT'],
  LOW:   ['HD', 'WMT', 'TGT'],
  AMZN_RETAIL: ['WMT', 'TGT', 'EBAY'],

  // ─── Financials ───────────────────────────────────────────────────────────
  JPM:   ['BAC', 'WFC', 'C'],
  BAC:   ['JPM', 'WFC', 'C'],
  WFC:   ['JPM', 'BAC', 'USB'],
  GS:    ['MS', 'JPM', 'BLK'],
  MS:    ['GS', 'JPM', 'BLK'],
  BLK:   ['GS', 'MS', 'SCHW'],
  SCHW:  ['BLK', 'MS', 'IBKR'],

  // ─── Communication ────────────────────────────────────────────────────────
  T:     ['VZ', 'TMUS', 'CMCSA'],
  VZ:    ['T', 'TMUS', 'DISH'],
  TMUS:  ['VZ', 'T', 'DISH'],
  CMCSA: ['DIS', 'NFLX', 'T'],
  DIS:   ['NFLX', 'CMCSA', 'WBD'],
};

export const SECTOR_PEERS: Record<string, string[]> = {
  'Technology':                  ['MSFT', 'AAPL', 'GOOGL'],
  'Semiconductors':              ['NVDA', 'AMD', 'INTC'],
  'Software—Application':        ['CRM', 'NOW', 'WDAY'],
  'Software—Infrastructure':     ['MSFT', 'ORCL', 'IBM'],
  'Healthcare':                  ['JNJ', 'PFE', 'UNH'],
  'Biotechnology':               ['AMGN', 'GILD', 'BIIB'],
  'Financials':                  ['JPM', 'BAC', 'WFC'],
  'Energy':                      ['XOM', 'CVX', 'COP'],
  'Consumer Discretionary':      ['AMZN', 'TSLA', 'HD'],
  'Consumer Staples':            ['WMT', 'PG', 'KO'],
  'Industrials':                 ['HON', 'GE', 'MMM'],
  'Utilities':                   ['NEE', 'DUK', 'SO'],
  'Real Estate':                 ['PLD', 'AMT', 'EQIX'],
  'Communication Services':      ['META', 'GOOGL', 'NFLX'],
  'Materials':                   ['LIN', 'APD', 'ECL'],
  'Cybersecurity':               ['CRWD', 'PANW', 'FTNT'],
  'Cloud Computing':             ['AMZN', 'MSFT', 'GOOGL'],
  'Electric Vehicles':           ['TSLA', 'GM', 'RIVN'],
  'Renewable Energy':            ['NEE', 'ENPH', 'FSLR'],
  'Payments':                    ['V', 'MA', 'PYPL'],
};

/**
 * Return a deterministic list of competitors for a given symbol.
 * Falls back to sector-based peers when no direct mapping exists.
 * Returns empty array if neither mapping exists — GPT must NOT invent peers.
 */
export function getCompetitors(symbol: string, industry?: string): string[] {
  const direct = COMPETITOR_MAP[symbol.toUpperCase()];
  if (direct?.length) return direct;

  if (industry) {
    // Exact sector match
    const exactSector = Object.entries(SECTOR_PEERS).find(([sector]) =>
      industry.toLowerCase().includes(sector.toLowerCase()),
    );
    if (exactSector) return exactSector[1].filter(p => p !== symbol).slice(0, 3);
  }

  return [];
}
