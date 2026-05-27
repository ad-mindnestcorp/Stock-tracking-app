import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { getQuote, getCompanyProfile, getWeek52Data, getBasicFinancials } from './finnhub.service';
import { calculateRSI } from './rsi.service';
import { calculateDMA } from './dma.service';
import { calculateSupportResistance } from './support-resistance.service';
import { getCached, setCached } from './research-cache';
import { withRetry, withTimeout } from '../utils/retry';
import { AI_CONFIG, ANTI_HALLUCINATION_SYSTEM_PROMPT, QUALITATIVE_WEBSEARCH_SYSTEM_PROMPT } from '../config/ai.config';
import { logAIResearch } from './ai-research-logger.service';
import { getCompetitors } from '../config/competitors.config';
import { normalizePercent, formatPercent, DATA_NOT_AVAILABLE } from '../utils/normalize-percent';
import {
  getVerifiedFinancials,
  getShortInterestData,
  getInsiderOwnershipData,
  getRevenueEstimatesData,
  getEarningsSurprisesData,
  getRelativeStrengthData,
  getVolumePatternData,
  getPeerMetricsData,
  computeHistoricalVolatility,
  getHistoricalPSData,
  getCustomerConcentrationData,
  getAsymmetryValuationData,
} from './market-data.service';
import { getFMPForwardPSData } from './fmp.service';
import { validateAIOutput, globalPostValidation, filterAllModulesForVerdict, FilteredVerdictInput } from './validation.service';
import { buildDataDrivenConfidence, buildQualitativeConfidence } from './confidence.service';
import {
  FoundationSchema,
  ValuationSchema,
  RisksSchema,
  TechnicalsSchema,
  VerdictSchema,
  PeerComparisonSchema,
  RuleOf40Schema,
  ForwardPSSchema,
  CustomerConcentrationSchema,
  ShortSellerPerspectiveSchema,
  HistoricalPSSchema,
  InsiderOwnershipSchema,
  AsymmetryAnalysisSchema,
  RelativeStrengthSchema,
  ShortInterestSchema,
  RetailSentimentSchema,
  VolumePatternsSchema,
  BullCaseCritiqueSchema,
  EarningsMissSchema,
  ImpliedVolatilitySchema,
  validateSection,
} from '../schemas/ai-sections';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIResearchFoundation {
  verdict: string;
  business_model: string[];
  moat: string[];
  catalysts: string[];
  asymmetry: string[];
  insights: string[];
}

export interface AIValuationFinancials {
  verdict: string;
  relative_valuation: string[];
  growth_metrics: string[];
  financial_health: string[];
  metrics: { label: string; value: string; note: string }[];
}

export interface AIRiskRedTeaming {
  verdict: string;
  bear_case: string[];
  sec_flags: string[];
  customer_concentration: string[];
  risks: { label: string; description: string }[];
}

export interface AITechnicals {
  verdict: string;
  price_trend: string[];
  moving_averages: string[];
  rsi: string[];
  support_resistance: string[];
  technical_view: string[];
}

export interface AIVerdict {
  overall: string;
  summary: string[];
  key_drivers: string[];
  key_risks: string[];
  catalysts: string[];
}

export interface NormalizedModuleOutput {
  verdict: string;
  bullPoints: string[];
  bearPoints: string[];
  score: number;
  confidence: number;
}

export type SectionSSEKey =
  | 'research_foundation'
  | 'valuation_financials'
  | 'risk_red_teaming'
  | 'technicals'
  | 'peer_comparison'
  | 'rule_of_40'
  | 'forward_ps'
  | 'customer_concentration'
  | 'short_seller_perspective'
  | 'historical_ps'
  | 'insider_ownership'
  | 'asymmetry_analysis'
  | 'relative_strength'
  | 'short_interest'
  | 'retail_sentiment'
  | 'volume_patterns'
  | 'bull_case_critique'
  | 'earnings_miss'
  | 'implied_volatility';

export type ResearchTier = 'basic' | 'decent' | 'indepth';

export const TIER_SECTIONS: Record<ResearchTier, SectionSSEKey[]> = {
  basic: ['research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals'],
  decent: [
    'research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals',
    'peer_comparison', 'rule_of_40', 'forward_ps', 'customer_concentration',
    'short_seller_perspective', 'historical_ps', 'insider_ownership', 'asymmetry_analysis',
  ],
  indepth: [
    'research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals',
    'peer_comparison', 'rule_of_40', 'forward_ps', 'customer_concentration',
    'short_seller_perspective', 'historical_ps', 'insider_ownership', 'asymmetry_analysis',
    'relative_strength', 'short_interest', 'retail_sentiment', 'volume_patterns',
    'bull_case_critique', 'earnings_miss', 'implied_volatility',
  ],
};

export interface SectionEvent {
  key: SectionSSEKey;
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
}

export interface VerdictEvent {
  status: 'success' | 'error';
  data?: AIVerdict;
  error?: string;
}

type Emit = (event: string, payload: unknown) => void;

// ─── OpenAI client ────────────────────────────────────────────────────────────

const SECTION_TIMEOUT_MS = AI_CONFIG.sectionTimeoutMs;

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// ─── GPT call wrapper ─────────────────────────────────────────────────────────

async function callGPT(opts: {
  prompt: string;
  useWebSearch: boolean;
  section: string;
  symbol: string;
  systemPrompt?: string;
}): Promise<unknown> {
  const { prompt, useWebSearch, section, symbol } = opts;
  const client = getOpenAI();
  const start = Date.now();
  let text: string;
  let model: string;
  let promptTokens: number | string = '?';
  let completionTokens: number | string = '?';

  const resolvedSystemPrompt = opts.systemPrompt ?? (
    useWebSearch ? QUALITATIVE_WEBSEARCH_SYSTEM_PROMPT : ANTI_HALLUCINATION_SYSTEM_PROMPT
  );

  if (useWebSearch) {
    model = AI_CONFIG.webSearchModel;
    const response = await client.responses.create({
      model,
      tools: [{ type: 'web_search_preview' }],
      max_output_tokens: AI_CONFIG.maxOutputTokens,
      input: [
        { role: 'system', content: resolvedSystemPrompt },
        { role: 'user', content: prompt },
      ] as ResponseInputItem[],
    });
    text = response.output_text ?? '{}';
    promptTokens = response.usage?.input_tokens ?? '?';
    completionTokens = response.usage?.output_tokens ?? '?';
    console.log(`[orchestrator:${section}] symbol=${symbol} model=${model} webSearch=true latencyMs=${Date.now() - start}`);
  } else {
    model = AI_CONFIG.chatModel;
    const response = await client.chat.completions.create({
      model,
      stream: false,
      temperature: AI_CONFIG.temperature,
      max_completion_tokens: AI_CONFIG.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: resolvedSystemPrompt },
        { role: 'user', content: prompt },
      ] as ChatCompletionMessageParam[],
    });
    text = response.choices[0]?.message?.content ?? '{}';
    promptTokens = response.usage?.prompt_tokens ?? '?';
    completionTokens = response.usage?.completion_tokens ?? '?';
    console.log(`[orchestrator:${section}] symbol=${symbol} model=${model} webSearch=false latencyMs=${Date.now() - start}`);
  }

  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const latencyMs = Date.now() - start;
  let parsedData: unknown;

  try {
    parsedData = JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsedData = JSON.parse(match[0]);
      } catch {
        throw new Error(`Invalid JSON response for section ${section}`);
      }
    } else {
      throw new Error(`Invalid JSON response for section ${section}`);
    }
  }

  logAIResearch({
    timestamp: new Date().toISOString(),
    symbol, section, model, useWebSearch, prompt,
    rawResponse: text, parsedData, latencyMs, promptTokens, completionTokens,
  }).catch(err => {
    console.error(`[orchestrator:${section}] Failed to log research: ${err instanceof Error ? err.message : err}`);
  });

  return parsedData;
}

// ─── Helper: inject confidence into validated output ──────────────────────────

function withConfidence<T extends Record<string, unknown>>(
  data: T,
  score: number,
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE' = 'CURRENT',
): T {
  return { ...data, confidence_score: score, data_freshness: freshness };
}

// ─── Helper: apply global post-validation ─────────────────────────────────────

function applyGlobalValidation<T extends Record<string, unknown>>(
  sectionKey: string,
  data: T,
  baseConfidence: number,
): { data: T; confidence: number; warnings: string[] } {
  const postValidation = globalPostValidation(sectionKey, data);
  
  // Apply confidence penalty from global validation
  const adjustedConfidence = Math.max(0, baseConfidence * (1 - postValidation.confidencePenalty));
  
  // Use sanitized data if available
  const sanitizedData = postValidation.sanitizedData 
    ? (postValidation.sanitizedData as T)
    : data;

  return {
    data: sanitizedData,
    confidence: adjustedConfidence,
    warnings: postValidation.issues,
  };
}

// ─── Core section prompt builders ─────────────────────────────────────────────

function buildFoundationPrompt(symbol: string, companyName: string, industry: string): string {
  return `Analyze ${symbol} (${companyName}, industry: ${industry}) for its research foundation.

You MAY use web search to find recent news, management commentary, and strategic developments.
Focus on QUALITATIVE analysis only — do NOT include specific revenue figures, price targets, or financial ratios.

VERIFIED STRUCTURED DATA:
- Symbol: ${symbol}
- Company: ${companyName}
- Industry: ${industry}

Return JSON with exactly these fields. All string items must be plain text, no URLs, no markdown, max 15 words each:
{"verdict":"Strong"|"Moderate"|"Weak","business_model":["bullet1","bullet2","bullet3"],"moat":["bullet1","bullet2","bullet3"],"catalysts":["bullet1","bullet2","bullet3"],"asymmetry":["bullet1","bullet2"],"insights":["insight1","insight2","insight3","insight4"]}`;
}

function buildValuationPrompt(
  symbol: string,
  companyName: string,
  price: number,
  marketCapB: number | null,
  metrics: {
    peRatioTTM: number | null; evEbitdaTTM: number | null; roeTTM: number | null;
    revenueGrowthTTMYoy: number | null; grossMarginTTM: number | null;
    netProfitMarginTTM: number | null; debtEquityTTM: number | null;
    currentRatioTTM: number | null; freeCashFlowTTM: number | null; psTTM: number | null;
  },
): string {
  const fmt = (v: number | null, suffix = '') =>
    v !== null ? `${Math.round(v * 100) / 100}${suffix}` : DATA_NOT_AVAILABLE;
  
  // Use centralized percent normalization
  const roeDisplay = formatPercent(metrics.roeTTM);
  const revenueGrowthDisplay = formatPercent(metrics.revenueGrowthTTMYoy);
  const grossMarginDisplay = formatPercent(metrics.grossMarginTTM);
  const netMarginDisplay = formatPercent(metrics.netProfitMarginTTM);

  return `Interpret the valuation picture for ${symbol} (${companyName}).

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or invent additional values.

VERIFIED STRUCTURED DATA [source: Finnhub API]:
- Price: $${price}
- Market Cap: ${marketCapB !== null ? `$${marketCapB}B` : DATA_NOT_AVAILABLE}
- P/E Ratio (TTM): ${fmt(metrics.peRatioTTM)}
- P/S Ratio (TTM): ${fmt(metrics.psTTM)}
- EV/EBITDA (TTM): ${fmt(metrics.evEbitdaTTM)}
- ROE (TTM): ${roeDisplay}
- Revenue Growth YoY (TTM): ${revenueGrowthDisplay}
- Gross Margin (TTM): ${grossMarginDisplay}
- Net Margin (TTM): ${netMarginDisplay}
- Debt/Equity: ${fmt(metrics.debtEquityTTM)}
- Current Ratio: ${fmt(metrics.currentRatioTTM)}
- Free Cash Flow (TTM): ${metrics.freeCashFlowTTM !== null ? `$${Math.round(metrics.freeCashFlowTTM / 1e6)}M` : DATA_NOT_AVAILABLE}

RULES:
- Use ONLY the above values — do NOT search for alternatives or fill in DATA_NOT_AVAILABLE fields
- For the metrics array, use exactly the values from above (do NOT substitute with web-searched values)
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON with exactly these fields:
{"verdict":"Positive"|"Neutral"|"Negative","relative_valuation":["bullet1","bullet2","bullet3"],"growth_metrics":["bullet1","bullet2","bullet3"],"financial_health":["bullet1","bullet2","bullet3"],"metrics":[{"label":"P/E Ratio","value":"${fmt(metrics.peRatioTTM)}","note":"vs sector avg"},{"label":"Revenue Growth","value":"${revenueGrowthDisplay}","note":"TTM YoY"},{"label":"Gross Margin","value":"${grossMarginDisplay}","note":"TTM"},{"label":"Free Cash Flow","value":"${metrics.freeCashFlowTTM !== null ? `$${Math.round(metrics.freeCashFlowTTM / 1e6)}M` : DATA_NOT_AVAILABLE}","note":"TTM"},{"label":"Debt/Equity","value":"${fmt(metrics.debtEquityTTM)}","note":"leverage"},{"label":"EV/EBITDA","value":"${fmt(metrics.evEbitdaTTM)}","note":"vs sector"},{"label":"ROE","value":"${roeDisplay}","note":"TTM"},{"label":"Current Ratio","value":"${fmt(metrics.currentRatioTTM)}","note":"liquidity"}]}`;
}

function buildRiskPrompt(symbol: string, companyName: string, industry: string): string {
  return `Analyze risks for ${symbol} (${companyName}, industry: ${industry}).

You MAY use web search to find recent news about regulatory developments, competitive threats, and market risks.
STRICTLY PROHIBITED: Do NOT fabricate SEC investigations, legal proceedings, or customer names/percentages.

VERIFIED STRUCTURED DATA:
- Symbol: ${symbol}
- Company: ${companyName}
- Industry: ${industry}

Return JSON with exactly these fields. All string items must be plain text, no URLs, no markdown, max 15 words each.
For sec_flags: only include if clearly documented — otherwise use ["No confirmed SEC investigations found via web search"].
For customer_concentration: only include if publicly disclosed — otherwise use ["Customer concentration data not publicly available"].

{"verdict":"Low"|"Moderate"|"Elevated"|"High","bear_case":["bullet1","bullet2","bullet3"],"sec_flags":["bullet1","bullet2","bullet3"],"customer_concentration":["bullet1","bullet2"],"risks":[{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"}]}`;
}

function buildTechnicalsPrompt(
  symbol: string, price: number,
  rsi: number | null, rsiTrend: string | null,
  ma50: number | null, ma200: number | null,
  support: number | null, resistance: number | null,
  high52w: number | null, low52w: number | null,
): string {
  return `Interpret the technical picture for ${symbol} using ONLY the verified market data below.

VERIFIED STRUCTURED DATA [source: Finnhub/Yahoo Finance — computed]:
- Price: $${price}
- RSI-14: ${rsi ?? 'DATA_NOT_AVAILABLE'} (trend: ${rsiTrend ?? 'DATA_NOT_AVAILABLE'})
- 50-day MA: ${ma50 ? `$${ma50.toFixed(2)} (price is ${price > ma50 ? 'above' : 'below'})` : 'DATA_NOT_AVAILABLE'}
- 200-day MA: ${ma200 ? `$${ma200.toFixed(2)} (price is ${price > ma200 ? 'above' : 'below'})` : 'DATA_NOT_AVAILABLE'}
- Support: ${support ? `$${support.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}
- Resistance: ${resistance ? `$${resistance.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}
- 52-week High: ${high52w ? `$${high52w.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}
- 52-week Low: ${low52w ? `$${low52w.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}

RULES:
- Interpret ONLY the above values — do NOT search for or estimate additional data
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Bullish"|"Neutral"|"Bearish","price_trend":["bullet1","bullet2"],"moving_averages":["bullet1","bullet2"],"rsi":["bullet1","bullet2"],"support_resistance":["bullet1","bullet2"],"technical_view":["bullet1","bullet2"]}`;
}

// ─── Decent tier prompt builders ──────────────────────────────────────────────

function buildPeerComparisonPrompt(
  symbol: string,
  companyName: string,
  peers: string[],
  peerDataMap: Map<string, { psTTM: number | null; evEbitdaTTM: number | null; grossMarginTTM: number | null; revenueGrowthTTMYoy: number | null; marketCapB: number | null }>,
  selfData: { psTTM: number | null; evEbitdaTTM: number | null; grossMarginTTM: number | null; revenueGrowthTTMYoy: number | null; marketCapB: number | null },
): string {
  const fmt = (v: number | null) => v !== null ? String(Math.round(v * 10) / 10) : DATA_NOT_AVAILABLE;

  const rows = [{ symbol, ...selfData }, ...peers.map(p => ({ symbol: p, ...peerDataMap.get(p) ?? { psTTM: null, evEbitdaTTM: null, grossMarginTTM: null, revenueGrowthTTMYoy: null, marketCapB: null } }))];

  const tableStr = rows.map(r => {
    const grossMarginResult = normalizePercent(r.grossMarginTTM, 'grossMargin');
    const revGrowthResult = normalizePercent(r.revenueGrowthTTMYoy, 'revenueGrowth');
    const vg = r.psTTM !== null && revGrowthResult.value !== null && revGrowthResult.value > 0
      ? String(Math.round((r.psTTM / revGrowthResult.value) * 100) / 100)
      : DATA_NOT_AVAILABLE;
    return `${r.symbol}: P/S=${fmt(r.psTTM)}, EV/EBITDA=${fmt(r.evEbitdaTTM)}, GrossMargin=${grossMarginResult.display}, RevGrowth=${revGrowthResult.display}, V/G=${vg}`;
  }).join('\n');

  return `Interpret the relative valuation for ${symbol} (${companyName}) vs its peers.

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or substitute alternative metrics.

VERIFIED PEER METRICS [source: Finnhub API]:
${tableStr}

RULES:
- Use ONLY the values above — replace missing peers with DATA_NOT_AVAILABLE in the table
- Do NOT invent or estimate any metric not provided
- All string items must be plain text, no URLs, no markdown, max 15 words each
- Peers to include: ${peers.join(', ')}

Return JSON:
{"verdict":"Attractive"|"Fair"|"Expensive","comparison_table":[${rows.map(r => {
  const grossMarginResult = normalizePercent(r.grossMarginTTM, 'grossMargin');
  const revGrowthResult = normalizePercent(r.revenueGrowthTTMYoy, 'revenueGrowth');
  const vg = r.psTTM !== null && revGrowthResult.value !== null && revGrowthResult.value > 0
    ? String(Math.round((r.psTTM / revGrowthResult.value) * 100) / 100)
    : DATA_NOT_AVAILABLE;
  return `{"symbol":"${r.symbol}","ps_ttm":"${fmt(r.psTTM)}","ps_forward":"DATA_NOT_AVAILABLE","ev_ebitda":"${fmt(r.evEbitdaTTM)}","gross_margin":"${grossMarginResult.display}","revenue_growth":"${revGrowthResult.display}","value_growth_score":"${vg}"}`;
}).join(',')}],"insights":["insight1","insight2","insight3"]}`;
}

function buildRuleOf40Prompt(
  symbol: string,
  companyName: string,
  revenueGrowthPct: number | null,
  ebitdaMarginPct: number | null,
): string {
  // Use centralized normalization - values come in as already-percent from caller
  const rgResult = normalizePercent(revenueGrowthPct, 'revenueGrowth');
  const emResult = normalizePercent(ebitdaMarginPct, 'ebitdaMargin');
  
  const score = rgResult.value !== null && emResult.value !== null
    ? String(Math.round(rgResult.value + emResult.value))
    : DATA_NOT_AVAILABLE;

  return `Interpret the Rule of 40 health for ${symbol} (${companyName}).

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or estimate quarterly data.

VERIFIED STRUCTURED DATA [source: Finnhub API — TTM]:
- Revenue Growth YoY (TTM): ${rgResult.display}
- EBITDA Margin (TTM): ${emResult.display}
- Rule of 40 Score (computed: RevGrowth + EBITDAMargin): ${score}

RULES:
- Use ONLY the TTM metrics above — for quarterly_data, you may note that quarterly breakdown is DATA_NOT_AVAILABLE
- Do NOT fill in quarterly figures with guesses
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Strong"|"Moderate"|"Weak","current_score":"${score}","trend":"Improving"|"Stable"|"Declining","quarterly_data":[{"quarter":"TTM","revenue_growth":"${rgResult.display}","ebitda_margin":"${emResult.display}","score":"${score}"}],"insights":["insight1","insight2","insight3"]}`;
}

function buildInsiderOwnershipPrompt(
  symbol: string,
  companyName: string,
  insiderPct: number | null,
  insiderCount: number | null,
): string {
  const pct = insiderPct !== null ? `${Math.round(insiderPct * 100) / 100}%` : 'DATA_NOT_AVAILABLE';
  const count = insiderCount !== null ? String(insiderCount) : 'DATA_NOT_AVAILABLE';

  // If insider ownership percentage is unavailable, force DATA_NOT_AVAILABLE verdict
  if (insiderPct === null) {
    return `Interpret insider ownership alignment for ${symbol} (${companyName}).

VERIFIED STRUCTURED DATA [source: Finnhub API]:
- Total Insider Ownership: DATA_NOT_AVAILABLE
- Number of Insider Positions Tracked: ${count}

CRITICAL: Insider ownership percentage is unavailable.
You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer "Moderate Alignment" or "Weak Alignment".

Return JSON:
{"verdict":"DATA_NOT_AVAILABLE","insider_ownership_pct":"DATA_NOT_AVAILABLE","industry_avg":"DATA_NOT_AVAILABLE","sbc_pct_revenue":"DATA_NOT_AVAILABLE","insights":["Insider ownership analysis requires ownership percentage data which is unavailable"]}`;
  }

  return `Interpret insider ownership alignment for ${symbol} (${companyName}).

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or substitute alternative ownership figures.

VERIFIED STRUCTURED DATA [source: Finnhub API]:
- Total Insider Ownership: ${pct}
- Number of Insider Positions Tracked: ${count}
- SBC (Stock-Based Compensation) as % of Revenue: DATA_NOT_AVAILABLE [requires SEC filing parse]

RULES:
- Use ONLY the insider % from verified data above
- Industry average comparison is qualitative context only — do NOT invent a specific %
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Strong Alignment"|"Moderate Alignment"|"Weak Alignment","insider_ownership_pct":"${pct}","industry_avg":"DATA_NOT_AVAILABLE","sbc_pct_revenue":"DATA_NOT_AVAILABLE","insights":["insight1","insight2","insight3"]}`;
}

// ─── In-depth tier prompt builders ────────────────────────────────────────────

function buildRelativeStrengthPrompt(
  symbol: string,
  return3m: number | null,
  spyReturn3m: number | null,
  rsVsSPY: number | null,
): string {
  const fmt = (v: number | null, suffix = '') => v !== null ? `${Math.round(v * 100) / 100}${suffix}` : 'DATA_NOT_AVAILABLE';

  return `Interpret the relative strength picture for ${symbol}.

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or substitute alternative RS data.

VERIFIED STRUCTURED DATA [source: computed from Finnhub/Yahoo Finance price history]:
- ${symbol} 3-Month Return: ${fmt(return3m, '%')}
- SPY (S&P 500) 3-Month Return: ${fmt(spyReturn3m, '%')}
- Relative Outperformance vs SPY: ${fmt(rsVsSPY, '%')}

RULES:
- Interpret ONLY the above values
- If a value is DATA_NOT_AVAILABLE, explicitly state it
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Outperforming"|"In-Line"|"Underperforming","rs_3m_trend":"Accelerating"|"Stable"|"Declining","breakout_breakdown":"${rsVsSPY !== null ? (rsVsSPY > 0 ? `Outperforming SPY by ${Math.round(rsVsSPY * 10) / 10}%` : `Underperforming SPY by ${Math.round(Math.abs(rsVsSPY) * 10) / 10}%`) : 'DATA_NOT_AVAILABLE'}","insights":["insight1","insight2","insight3"]}`;
}

function buildShortInterestPrompt(
  symbol: string,
  shortInterestPct: number | null,
  daysToCover: number | null,
  reportDate: string | null,
): string {
  const pct = shortInterestPct !== null ? `${Math.round(shortInterestPct * 100) / 100}%` : 'DATA_NOT_AVAILABLE';
  const dtc = daysToCover !== null ? `${Math.round(daysToCover * 10) / 10} days` : 'DATA_NOT_AVAILABLE';
  const dt = reportDate ?? 'DATA_NOT_AVAILABLE';

  // If both key metrics are unavailable, force DATA_NOT_AVAILABLE verdict
  if (shortInterestPct === null && daysToCover === null) {
    return `Interpret the short interest setup for ${symbol}.

VERIFIED STRUCTURED DATA [source: Finnhub API]:
- Short Interest (% of shares outstanding): DATA_NOT_AVAILABLE
- Days to Cover: DATA_NOT_AVAILABLE
- Report Date: ${dt}

CRITICAL: Short interest data is unavailable.
You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer "Moderate" or "Low".

Return JSON:
{"verdict":"DATA_NOT_AVAILABLE","short_interest_pct":"DATA_NOT_AVAILABLE","days_to_cover":"DATA_NOT_AVAILABLE","trend_12m":"DATA_NOT_AVAILABLE","squeeze_potential":"DATA_NOT_AVAILABLE","insights":["Short interest analysis requires actual short interest data which is unavailable"]}`;
  }

  return `Interpret the short interest setup for ${symbol}.

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or substitute with Fintel/ShortSqueeze estimates.

VERIFIED STRUCTURED DATA [source: Finnhub API]:
- Short Interest (% of shares outstanding): ${pct}
- Days to Cover: ${dtc}
- Report Date: ${dt}
- 12-Month Trend: DATA_NOT_AVAILABLE [requires historical time series — not available from single report]

RULES:
- Interpret ONLY the values above
- trend_12m should reflect "DATA_NOT_AVAILABLE" since only a single data point is provided
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"High Squeeze Potential"|"Moderate"|"Low","short_interest_pct":"${pct}","days_to_cover":"${dtc}","trend_12m":"DATA_NOT_AVAILABLE","squeeze_potential":"${shortInterestPct !== null && shortInterestPct > 15 ? 'High if catalyst present' : shortInterestPct !== null ? 'Low to Moderate' : 'DATA_NOT_AVAILABLE'}","insights":["insight1","insight2","insight3"]}`;
}

function buildRetailSentimentPrompt(symbol: string): string {
  return `Search recent social media sentiment for ${symbol} (last 7 days).

You MAY use web search to find recent Stocktwits and Reddit discussions.
Focus on QUALITATIVE sentiment — do NOT invent specific sentiment scores or claim exact percentages.

RULES:
- Sentiment score should reflect qualitative mood (e.g., 60/100 = moderately bullish), not an exact API number
- Do NOT claim you searched specific user handles or posts you cannot verify
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Bullish"|"Neutral"|"Bearish","sentiment_score":"DATA_NOT_AVAILABLE","stocktwits_sentiment":"Bullish"|"Neutral"|"Bearish","reddit_sentiment":"Bullish"|"Neutral"|"Bearish","insights":["insight1","insight2","insight3"]}`;
}

function buildVolumePatternsPrompt(
  symbol: string,
  avgVolume30d: number | null,
  currentVolume: number | null,
  volumeRatio: number | null,
  highVolumeDays: number,
  dataAvailable: boolean,
): string {
  // If data is not available, return a prompt that produces an insufficient data response
  if (!dataAvailable || (avgVolume30d === null && currentVolume === null)) {
    return `Interpret the volume patterns for ${symbol}.

VERIFIED STRUCTURED DATA [source: computed from Finnhub/Yahoo Finance]:
- 30-Day Average Daily Volume: ${DATA_NOT_AVAILABLE}
- Today's Volume: ${DATA_NOT_AVAILABLE}
- Volume Ratio: ${DATA_NOT_AVAILABLE}
- High Volume Days: ${DATA_NOT_AVAILABLE}

CRITICAL: Volume data is unavailable or insufficient.

RULES:
- Do NOT infer patterns when data is unavailable
- Do NOT say "No high volume days" when you have no data
- You MUST indicate insufficient data in your response

Return JSON:
{"verdict":"${DATA_NOT_AVAILABLE}","recent_patterns":["Insufficient volume data to analyze patterns"],"breakout_breakdown":"Insufficient volume data","insights":["Volume analysis requires historical data which is currently unavailable"]}`;
  }

  const avg = avgVolume30d !== null ? avgVolume30d.toLocaleString() : DATA_NOT_AVAILABLE;
  const cur = currentVolume !== null ? currentVolume.toLocaleString() : DATA_NOT_AVAILABLE;
  const ratio = volumeRatio !== null ? `${Math.round(volumeRatio * 100) / 100}x average` : DATA_NOT_AVAILABLE;

  // Handle partial data unavailability - if volume ratio is null, we cannot make volume spike conclusions
  const breakoutText = volumeRatio !== null 
    ? (volumeRatio > 2 ? `High volume day: ${Math.round(volumeRatio * 10) / 10}x average` : 'No significant volume spike today')
    : 'Insufficient volume data';

  // If volume ratio is unavailable, enforce DATA_NOT_AVAILABLE verdict
  if (volumeRatio === null) {
    return `Interpret the volume patterns for ${symbol}.

VERIFIED STRUCTURED DATA [source: computed from Finnhub/Yahoo Finance]:
- 30-Day Average Daily Volume: ${avg}
- Today's Volume: ${cur}
- Volume Ratio (today / 30d avg): DATA_NOT_AVAILABLE
- High Volume Days (> 2x avg) in last 30 days: ${highVolumeDays}

CRITICAL: Volume ratio is unavailable. You MUST return verdict="DATA_NOT_AVAILABLE".
Do NOT infer "No volume spike" or any patterns without actual volume ratio data.

Return JSON:
{"verdict":"DATA_NOT_AVAILABLE","recent_patterns":["Insufficient volume data to analyze patterns"],"breakout_breakdown":"Insufficient volume data","insights":["Volume pattern analysis requires volume ratio data which is unavailable"]}`;
  }

  return `Interpret the volume patterns for ${symbol}.

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or estimate alternative volume data.

VERIFIED STRUCTURED DATA [source: computed from Finnhub/Yahoo Finance]:
- 30-Day Average Daily Volume: ${avg}
- Today's Volume: ${cur}
- Volume Ratio (today / 30d avg): ${ratio}
- High Volume Days (> 2x avg) in last 30 days: ${highVolumeDays}

RULES:
- Interpret ONLY the above values
- If any metric is DATA_NOT_AVAILABLE, do NOT infer or guess patterns
- Do NOT say "No volume spike" when volume ratio is unavailable — say "Insufficient volume data"
- Do NOT claim "No high volume days" unless you have confirmed data showing zero high volume days
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Bullish Pattern"|"Neutral"|"Bearish Pattern","recent_patterns":["pattern1","pattern2"],"breakout_breakdown":"${breakoutText}","insights":["insight1","insight2","insight3"]}`;
}

function buildShortSellerPerspectivePrompt(symbol: string, companyName: string): string {
  return `Analyze ${symbol} (${companyName}) from a skeptical short-seller perspective.

You MAY use web search to find recent short reports, bear theses, and documented concerns.
Focus on DOCUMENTED concerns — do NOT fabricate specific allegations or legal claims.

RULES:
- Only include claims that are publicly documented in short reports or analyst criticism
- Do NOT invent SEC investigations or legal proceedings
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Compelling Short"|"Moderate Concerns"|"Weak Short Case","bear_thesis":["thesis1","thesis2","thesis3"],"short_catalysts":["catalyst1","catalyst2"],"counter_arguments":["counter1","counter2"],"insights":["insight1","insight2","insight3"]}`;
}

function buildBullCaseCritiquePrompt(symbol: string, companyName: string): string {
  return `Critique the bull case for ${symbol} (${companyName}).

You MAY use web search to find recent skeptical analysis, market discount reasons, and valuation debates.
Focus on DOCUMENTED concerns — do NOT fabricate specific allegations.

RULES:
- Only include claims that are publicly documented or debated
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Bull Case Holds"|"Bull Case Questionable"|"Bull Case Weak","bull_thesis":["thesis1","thesis2"],"critique_points":["critique1","critique2","critique3"],"market_discount_reason":["reason1","reason2"]}`;
}

function buildEarningsMissPrompt(
  symbol: string,
  surprises: Array<{ quarter: string; surprisePct: number | null; period: string }>,
  recentMisses: number,
): string {
  const recentSurprises = surprises.slice(0, 4).map(s =>
    `${s.quarter}: surprise = ${s.surprisePct !== null ? `${Math.round(s.surprisePct * 100) / 100}%` : 'DATA_NOT_AVAILABLE'}`,
  ).join(', ') || 'DATA_NOT_AVAILABLE';

  const lastMiss = surprises.find(s => s.surprisePct !== null && s.surprisePct < -2);

  return `Interpret the earnings track record for ${symbol}.

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or substitute with alternative earnings data.

VERIFIED STRUCTURED DATA [source: Finnhub API — EPS surprises]:
- Recent Earnings Surprises: ${recentSurprises}
- Misses (>-2% surprise) in last ${surprises.length} quarters: ${recentMisses}
- Most Recent Miss: ${lastMiss ? `${lastMiss.quarter} (${lastMiss.surprisePct !== null ? `${Math.round(lastMiss.surprisePct * 100) / 100}%` : 'N/A'} surprise)` : 'No recent miss found'}

RULES:
- Use ONLY the above earnings data
- Stock reaction on earnings day is DATA_NOT_AVAILABLE unless you can find it via web search
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Clean Track"|"Recent Miss"|"Multiple Misses","last_miss_date":"${lastMiss ? lastMiss.quarter : 'No miss in recent quarters'}","miss_reason":"DATA_NOT_AVAILABLE","stock_reaction":"DATA_NOT_AVAILABLE","insights":["insight1","insight2"]}`;
}

function buildImpliedVolatilityPrompt(
  symbol: string,
  hv30: number | null,
): string {
  const hv = hv30 !== null ? `${Math.round(hv30 * 100) / 100}%` : 'DATA_NOT_AVAILABLE';
  let verdict = 'Normal IV';
  if (hv30 !== null) {
    if (hv30 > 60) verdict = 'High IV';
    else if (hv30 < 20) verdict = 'Low IV';
  }

  return `Interpret the volatility picture for ${symbol}.

Using ONLY the VERIFIED STRUCTURED DATA below.
Implied Volatility requires an options API which is not available — only Historical Volatility is verified.

VERIFIED STRUCTURED DATA [source: computed from Finnhub/Yahoo Finance price data]:
- Historical Volatility (30-day annualised): ${hv}
- Implied Volatility (30-day): DATA_NOT_AVAILABLE [requires options API — not available]
- IV Percentile: DATA_NOT_AVAILABLE

RULES:
- Set current_iv and iv_percentile to "DATA_NOT_AVAILABLE"
- Set historical_iv to the verified HV value: ${hv}
- Interpret the volatility level based on HV alone
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"${verdict}","current_iv":"DATA_NOT_AVAILABLE","historical_iv":"${hv}","iv_percentile":"DATA_NOT_AVAILABLE","insights":["insight1","insight2","insight3"]}`;
}

// ─── Verdict prompt ───────────────────────────────────────────────────────────

/**
 * Module weight categories for balanced verdict calculation.
 * Prevents risk modules from dominating final verdict.
 */
const MODULE_WEIGHTS: Record<string, { weight: number; category: 'positive' | 'negative' | 'neutral' }> = {
  research_foundation: { weight: 25, category: 'positive' },
  valuation_financials: { weight: 25, category: 'neutral' },
  technicals: { weight: 20, category: 'neutral' },
  risk_red_teaming: { weight: 15, category: 'negative' },  // Capped risk weight
  momentum: { weight: 15, category: 'positive' },
};

function computeWeightedScore(coreModules: Record<string, NormalizedModuleOutput>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, module] of Object.entries(coreModules)) {
    const config = MODULE_WEIGHTS[key] ?? { weight: 10, category: 'neutral' };
    totalWeight += config.weight;
    weightedSum += module.score * config.weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

export function buildVerdictFromModulesPrompt(
  symbol: string,
  companyName: string,
  coreModules: Record<string, NormalizedModuleOutput>,
  additionalModules?: Record<string, NormalizedModuleOutput>,
): string {
  // Compute weighted score to guide verdict
  const weightedScore = computeWeightedScore(coreModules);
  
  const coreSections = (Object.entries(coreModules) as [string, NormalizedModuleOutput][])
    .map(([key, m]) => {
      const label = key.replace(/_/g, ' ');
      const moduleWeight = MODULE_WEIGHTS[key]?.weight ?? 10;
      return `${label} (verdict: ${m.verdict}, score: ${m.score}/100, weight: ${moduleWeight}%, confidence: ${(m.confidence * 100).toFixed(0)}%):
  Bull: ${m.bullPoints.join(' | ')}
  Bear: ${m.bearPoints.join(' | ')}`;
    }).join('\n\n');

  let additionalSections = '';
  if (additionalModules && Object.keys(additionalModules).length > 0) {
    additionalSections = '\n\nADDITIONAL INSIGHTS:\n\n' +
      (Object.entries(additionalModules) as [string, NormalizedModuleOutput][])
        .map(([key, m]) => `${key.replace(/_/g, ' ')} (verdict: ${m.verdict}, score: ${m.score}/100):
  Bull: ${m.bullPoints.join(' | ')}
  Bear: ${m.bearPoints.join(' | ')}`)
        .join('\n\n');
  }

  // Provide guidance based on weighted score
  let verdictGuidance = '';
  if (weightedScore >= 70) {
    verdictGuidance = 'Weighted score suggests Bullish bias — only use Bearish if fundamentals have critical flaws.';
  } else if (weightedScore >= 55) {
    verdictGuidance = 'Weighted score suggests slight Bullish or Neutral — avoid Bearish unless justified by severe risks.';
  } else if (weightedScore >= 45) {
    verdictGuidance = 'Weighted score is balanced — Neutral is appropriate unless clear directional signal exists.';
  } else if (weightedScore >= 30) {
    verdictGuidance = 'Weighted score suggests cautious — Neutral to Moderately Bearish is appropriate.';
  } else {
    verdictGuidance = 'Weighted score suggests significant concerns — Bearish may be appropriate.';
  }

  return `Synthesize an overall investment verdict for ${symbol} (${companyName}) based on these completed research module outputs.

Using ONLY the data below — do NOT use web search or invent additional information.

COMPUTED WEIGHTED SCORE: ${Math.round(weightedScore)}/100
${verdictGuidance}

CORE FUNDAMENTALS (weighted by importance — fundamentals and valuation weighted higher than risks):
${coreSections}${additionalSections}

CRITICAL WEIGHTING RULES:
- Fundamentals (research_foundation): 25% weight — strong fundamentals should anchor the verdict
- Valuation (valuation_financials): 25% weight — valuation context is key
- Technicals: 20% weight — price action matters but secondary
- Risks (risk_red_teaming): 15% weight — risks inform but should NOT dominate
- Do NOT let elevated risks override strong fundamentals + neutral valuation
- A "Strong" foundation + "Neutral" valuation should NOT produce "Moderately Bearish"
- Reserve "Bearish" verdicts for when fundamentals OR valuation are negative
- Do NOT fabricate analyst targets, price targets, or consensus ratings
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"overall":"Strongly Bullish"|"Moderately Bullish"|"Neutral"|"Moderately Bearish"|"Strongly Bearish","summary":["bullet1","bullet2","bullet3"],"key_drivers":["driver1","driver2","driver3"],"key_risks":["risk1","risk2","risk3"],"catalysts":["catalyst1","catalyst2","catalyst3"]}`;
}

// ─── Normalization helpers ─────────────────────────────────────────────────────

const VERDICT_SCORES: Record<string, number> = {
  Strong: 80, Moderate: 55, Weak: 25,
  Positive: 80, Neutral: 50, Negative: 20,
  Low: 80, Elevated: 35, High: 15,
  Bullish: 80, Bearish: 20,
};

function verdictConfidence(verdict: string): number {
  const extreme = ['Strong', 'Weak', 'Positive', 'Negative', 'Low', 'High', 'Bullish', 'Bearish'];
  return extreme.includes(verdict) ? 0.85 : 0.60;
}

export function normalizeFoundation(data: AIResearchFoundation): NormalizedModuleOutput {
  return {
    verdict: data.verdict,
    bullPoints: [...(data.catalysts ?? []).slice(0, 2), ...(data.moat ?? []).slice(0, 1)].filter(Boolean),
    bearPoints: (data.asymmetry ?? []).slice(0, 2).filter(Boolean),
    score: VERDICT_SCORES[data.verdict] ?? 50,
    confidence: verdictConfidence(data.verdict),
  };
}

export function normalizeValuation(data: AIValuationFinancials): NormalizedModuleOutput {
  return {
    verdict: data.verdict,
    bullPoints: (data.financial_health ?? []).slice(0, 2).filter(Boolean),
    bearPoints: (data.relative_valuation ?? []).slice(0, 2).filter(Boolean),
    score: VERDICT_SCORES[data.verdict] ?? 50,
    confidence: verdictConfidence(data.verdict),
  };
}

export function normalizeRisks(data: AIRiskRedTeaming): NormalizedModuleOutput {
  const topRisks = (data.risks ?? []).slice(0, 2).map(r => r.description).filter(Boolean);
  return {
    verdict: data.verdict,
    bullPoints: (data.customer_concentration ?? []).slice(0, 1).filter(Boolean),
    bearPoints: [...(data.bear_case ?? []).slice(0, 1), ...topRisks.slice(0, 1)].filter(Boolean),
    score: VERDICT_SCORES[data.verdict] ?? 50,
    confidence: verdictConfidence(data.verdict),
  };
}

export function normalizeTechnicals(data: AITechnicals): NormalizedModuleOutput {
  return {
    verdict: data.verdict,
    bullPoints: (data.technical_view ?? []).slice(0, 2).filter(Boolean),
    bearPoints: (data.support_resistance ?? []).slice(0, 1).filter(Boolean),
    score: VERDICT_SCORES[data.verdict] ?? 50,
    confidence: verdictConfidence(data.verdict),
  };
}

export function normalizeGenericSection(data: Record<string, unknown>): NormalizedModuleOutput {
  const verdict = (data.verdict as string) ?? 'Neutral';
  const bullPoints: string[] = [];
  if (data.insights) bullPoints.push(...(data.insights as string[]).slice(0, 2));
  if (data.bull_thesis) bullPoints.push(...(data.bull_thesis as string[]).slice(0, 1));
  if (data.bull_case) bullPoints.push(...(data.bull_case as string[]).slice(0, 1));

  const bearPoints: string[] = [];
  if (data.critique_points) bearPoints.push(...(data.critique_points as string[]).slice(0, 1));
  if (data.bear_thesis) bearPoints.push(...(data.bear_thesis as string[]).slice(0, 1));
  if (data.short_catalysts) bearPoints.push(...(data.short_catalysts as string[]).slice(0, 1));
  if (data.bear_case) bearPoints.push(...(data.bear_case as string[]).slice(0, 1));

  let score = 50;
  const vl = verdict.toLowerCase();
  if (vl.includes('strong') || vl.includes('bullish') || vl.includes('attractive') || vl.includes('outperform')) score = 75;
  else if (vl.includes('weak') || vl.includes('bearish') || vl.includes('expensive') || vl.includes('unfavorable')) score = 25;

  return {
    verdict,
    bullPoints: bullPoints.filter(Boolean).slice(0, 2),
    bearPoints: bearPoints.filter(Boolean).slice(0, 2),
    score,
    confidence: 0.65,
  };
}

// ─── Module runners ────────────────────────────────────────────────────────────

async function runFoundation(symbol: string): Promise<AIResearchFoundation> {
  const cacheKey = `foundation:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AIResearchFoundation;

  const profile = await getCompanyProfile(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildFoundationPrompt(symbol, profile?.name ?? symbol, profile?.industry ?? ''),
      useWebSearch: true,
      section: 'foundation',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('foundation', raw);
  const baseConfidence = buildQualitativeConfidence(validation);
  const data = validateSection(FoundationSchema, raw, 'foundation') as AIResearchFoundation;
  
  // Apply global post-validation
  const { data: validatedData, confidence: adjustedConfidence, warnings } = 
    applyGlobalValidation('foundation', data as unknown as Record<string, unknown>, baseConfidence.score);
  
  if (warnings.length > 0) {
    console.warn(`[orchestrator:foundation] symbol=${symbol} globalValidationWarnings=${warnings.join('; ')}`);
  }
  
  const result = withConfidence(validatedData, adjustedConfidence) as unknown as AIResearchFoundation;

  setCached(cacheKey, result);
  return result;
}

async function runValuation(symbol: string): Promise<AIValuationFinancials> {
  const cacheKey = `valuation:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AIValuationFinancials;

  const verified = await getVerifiedFinancials(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildValuationPrompt(symbol, verified.companyName, verified.price, verified.marketCapB, {
        peRatioTTM: verified.peRatioTTM,
        evEbitdaTTM: verified.evEbitdaTTM,
        roeTTM: verified.roeTTM,
        revenueGrowthTTMYoy: verified.revenueGrowthTTMYoy,
        grossMarginTTM: verified.grossMarginTTM,
        netProfitMarginTTM: verified.netProfitMarginTTM,
        debtEquityTTM: verified.debtEquityTTM,
        currentRatioTTM: verified.currentRatioTTM,
        freeCashFlowTTM: verified.freeCashFlowTTM,
        psTTM: verified.psTTM,
      }),
      useWebSearch: false,
      section: 'valuation',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('valuation', raw);
  const baseConfidence = buildDataDrivenConfidence(verified.dataCompleteness, validation);
  const data = validateSection(ValuationSchema, raw, 'valuation') as AIValuationFinancials;
  
  // Apply global post-validation
  const { data: validatedData, confidence: adjustedConfidence, warnings } = 
    applyGlobalValidation('valuation', data as unknown as Record<string, unknown>, baseConfidence.score);
  
  if (warnings.length > 0) {
    console.warn(`[orchestrator:valuation] symbol=${symbol} globalValidationWarnings=${warnings.join('; ')}`);
  }
  
  const result = withConfidence(validatedData, adjustedConfidence) as unknown as AIValuationFinancials;

  setCached(cacheKey, result);
  return result;
}

async function runRisks(symbol: string): Promise<AIRiskRedTeaming> {
  const cacheKey = `risks:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AIRiskRedTeaming;

  const profile = await getCompanyProfile(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildRiskPrompt(symbol, profile?.name ?? symbol, profile?.industry ?? ''),
      useWebSearch: true,
      section: 'risks',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('risks', raw);
  const baseConfidence = buildQualitativeConfidence(validation);
  const data = validateSection(RisksSchema, raw, 'risks') as AIRiskRedTeaming;
  
  // Apply global post-validation - critical for risks which may contain unsupported claims
  const { data: validatedData, confidence: adjustedConfidence, warnings } = 
    applyGlobalValidation('risks', data as unknown as Record<string, unknown>, baseConfidence.score);
  
  if (warnings.length > 0) {
    console.warn(`[orchestrator:risks] symbol=${symbol} globalValidationWarnings=${warnings.join('; ')}`);
  }
  
  const result = withConfidence(validatedData, adjustedConfidence) as unknown as AIRiskRedTeaming;

  setCached(cacheKey, result);
  return result;
}

async function runTechnicals(symbol: string): Promise<AITechnicals> {
  const cacheKey = `technicals:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AITechnicals;

  const [quote, week52] = await Promise.all([getQuote(symbol), getWeek52Data(symbol)]);
  const price = quote.currentPrice ?? 0;
  const rsiResult = week52?.closes ? calculateRSI(week52.closes) : null;
  const dmaResult = week52?.closes ? calculateDMA(week52.closes, price) : null;
  const srResult = week52?.recentHighs && week52.recentLows
    ? calculateSupportResistance(week52.recentLows, week52.recentHighs, price)
    : null;

  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildTechnicalsPrompt(
        symbol, price,
        rsiResult?.rsi ?? null, rsiResult?.rsiTrend ?? null,
        dmaResult?.ma50 ?? null, dmaResult?.ma200 ?? null,
        srResult?.support ?? null, srResult?.resistance ?? null,
        week52?.high52w ?? null, week52?.low52w ?? null,
      ),
      useWebSearch: false,
      section: 'technicals',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const dataCompleteness = [rsiResult, dmaResult?.ma50, dmaResult?.ma200, srResult?.support, srResult?.resistance, week52?.high52w, week52?.low52w]
    .filter(v => v !== null && v !== undefined).length / 7;
  const validation = validateAIOutput('technicals', raw);
  const confidence = buildDataDrivenConfidence(dataCompleteness, validation);
  const data = validateSection(TechnicalsSchema, raw, 'technicals') as AITechnicals;
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score) as unknown as AITechnicals;

  setCached(cacheKey, result);
  return result;
}

async function runPeerComparison(symbol: string): Promise<unknown> {
  const cacheKey = `peer_comparison:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [profile, selfVerified] = await Promise.all([
    getCompanyProfile(symbol),
    getVerifiedFinancials(symbol),
  ]);
  
  // VALIDATION: If BOTH P/S AND EV/EBITDA are unavailable, return DATA_NOT_AVAILABLE
  // Peer comparison requires at least one valuation metric to be meaningful
  const hasPSTTM = selfVerified.psTTM !== null;
  const hasEvEbitda = selfVerified.evEbitdaTTM !== null;
  
  if (!hasPSTTM && !hasEvEbitda) {
    console.warn(`[orchestrator:peer_comparison] ${symbol} — both P/S and EV/EBITDA unavailable, returning DATA_NOT_AVAILABLE`);
    const result = {
      verdict: DATA_NOT_AVAILABLE,
      comparison_table: [],
      insights: [
        'Peer comparison requires at least P/S or EV/EBITDA for meaningful analysis',
        'Both valuation metrics unavailable for the target company',
        'Unable to determine relative valuation without core metrics',
      ],
      confidence_score: 0,
      data_freshness: 'UNAVAILABLE',
    };
    setCached(cacheKey, result);
    return result;
  }

  const peers = getCompetitors(symbol, profile?.industry ?? '');
  const peerMetrics = await getPeerMetricsData(peers);

  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildPeerComparisonPrompt(symbol, profile?.name ?? symbol, peers, peerMetrics, {
        psTTM: selfVerified.psTTM,
        evEbitdaTTM: selfVerified.evEbitdaTTM,
        grossMarginTTM: selfVerified.grossMarginTTM,
        revenueGrowthTTMYoy: selfVerified.revenueGrowthTTMYoy,
        marketCapB: selfVerified.marketCapB,
      }),
      useWebSearch: false,
      section: 'peer_comparison',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('peer_comparison', raw);
  const confidence = buildDataDrivenConfidence(selfVerified.dataCompleteness, validation);
  const data = validateSection(PeerComparisonSchema, raw, 'peer_comparison');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score);

  setCached(cacheKey, result);
  return result;
}

async function runRuleOf40(symbol: string): Promise<unknown> {
  const cacheKey = `rule_of_40:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const verified = await getVerifiedFinancials(symbol);
  
  // Rule of 40 = Revenue Growth + EBITDA Margin (NOT Gross Margin!)
  // Use centralized normalization - pass raw values, normalizePercent handles decimal vs percent
  const revenueGrowthPct = verified.revenueGrowthTTMYoy;
  const ebitdaMarginPct = verified.ebitdaMarginTTM;

  // Validate inputs - reject impossible values before sending to GPT
  const rgResult = normalizePercent(revenueGrowthPct, 'revenueGrowth');
  const emResult = normalizePercent(ebitdaMarginPct, 'ebitdaMargin');

  // If both metrics are unavailable, return DATA_NOT_AVAILABLE without calling GPT
  if (!rgResult.valid && !emResult.valid) {
    console.warn(`[orchestrator:rule_of_40] ${symbol} — both revenue growth and EBITDA margin unavailable`);
    const result = {
      verdict: DATA_NOT_AVAILABLE,
      current_score: DATA_NOT_AVAILABLE,
      trend: DATA_NOT_AVAILABLE,
      quarterly_data: [],
      insights: [
        'Rule of 40 calculation requires revenue growth and EBITDA margin data',
        'Both metrics are currently unavailable for this company',
      ],
      confidence_score: 0,
      data_freshness: 'UNAVAILABLE',
    };
    setCached(cacheKey, result);
    return result;
  }

  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildRuleOf40Prompt(symbol, verified.companyName, revenueGrowthPct, ebitdaMarginPct),
      useWebSearch: false,
      section: 'rule_of_40',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('rule_of_40', raw);
  const confidence = buildDataDrivenConfidence(verified.dataCompleteness, validation);
  const data = validateSection(RuleOf40Schema, raw, 'rule_of_40');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score);

  setCached(cacheKey, result);
  return result;
}

async function runForwardPS(symbol: string): Promise<unknown> {
  const cacheKey = `forward_ps:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const verified = await getVerifiedFinancials(symbol);
  
  // Use deterministic FMP data instead of GPT inference
  const fmpData = await getFMPForwardPSData(symbol, verified.marketCapB);

  if (!fmpData.available) {
    // Return structured DATA_NOT_AVAILABLE response
    const result = {
      verdict: DATA_NOT_AVAILABLE,
      ttm_ps: verified.psTTM !== null ? String(Math.round(verified.psTTM * 10) / 10) : DATA_NOT_AVAILABLE,
      forward_ps: DATA_NOT_AVAILABLE,
      forward_ev_ebitda: DATA_NOT_AVAILABLE,
      guidance: DATA_NOT_AVAILABLE,
      stress_test: ['Forward valuation analysis requires analyst revenue estimates'],
      insights: ['Forward P/S calculation requires next-year revenue estimates from FMP or Finnhub'],
      confidence_score: 0,
      data_freshness: 'UNAVAILABLE',
    };

    setCached(cacheKey, result);
    return result;
  }

  // Compute stress test scenarios for P/S
  const stressMinus10 = fmpData.nextYearRevenue && fmpData.currentMarketCap
    ? Math.round(((fmpData.currentMarketCap / (fmpData.nextYearRevenue * 0.9))) * 10) / 10
    : null;
  const stressMinus20 = fmpData.nextYearRevenue && fmpData.currentMarketCap
    ? Math.round(((fmpData.currentMarketCap / (fmpData.nextYearRevenue * 0.8))) * 10) / 10
    : null;

  // Compute stress test scenarios for EV/EBITDA
  const evEbitdaStressMinus10 = fmpData.nextYearEbitda && fmpData.currentEV
    ? Math.round(((fmpData.currentEV / (fmpData.nextYearEbitda * 0.9))) * 10) / 10
    : null;

  // Determine verdict based on both P/S and EV/EBITDA
  let verdict = DATA_NOT_AVAILABLE;
  if (fmpData.forwardPS !== null || fmpData.forwardEvEbitda !== null) {
    const psAttractive = fmpData.forwardPS !== null && fmpData.ttmPS !== null && fmpData.forwardPS < fmpData.ttmPS * 0.9;
    const psStretched = fmpData.forwardPS !== null && fmpData.ttmPS !== null && fmpData.forwardPS > fmpData.ttmPS * 1.1;
    const evAttractive = fmpData.forwardEvEbitda !== null && fmpData.forwardEvEbitda < 15;
    const evStretched = fmpData.forwardEvEbitda !== null && fmpData.forwardEvEbitda > 25;

    if (psAttractive || evAttractive) {
      verdict = 'Attractive';
    } else if (psStretched && evStretched) {
      verdict = 'Stretched';
    } else {
      verdict = 'Fair';
    }
  }

  const result = {
    verdict,
    ttm_ps: fmpData.ttmPS !== null ? String(fmpData.ttmPS) : DATA_NOT_AVAILABLE,
    forward_ps: fmpData.forwardPS !== null ? String(fmpData.forwardPS) : DATA_NOT_AVAILABLE,
    forward_ev_ebitda: fmpData.forwardEvEbitda !== null ? String(fmpData.forwardEvEbitda) : DATA_NOT_AVAILABLE,
    guidance: fmpData.nextYearRevenue !== null
      ? `Revenue: $${Math.round(fmpData.nextYearRevenue / 1e6)}M for ${fmpData.fiscalYear ?? 'FY'} (${fmpData.analystCount ?? 'N/A'} analysts)`
      : DATA_NOT_AVAILABLE,
    ebitda_guidance: fmpData.nextYearEbitda !== null
      ? `EBITDA: $${Math.round(fmpData.nextYearEbitda / 1e6)}M for ${fmpData.fiscalYear ?? 'FY'}`
      : DATA_NOT_AVAILABLE,
    stress_test: [
      stressMinus10 ? `If revenue misses by 10%: P/S = ${stressMinus10}` : 'P/S stress test unavailable',
      stressMinus20 ? `If revenue misses by 20%: P/S = ${stressMinus20}` : 'P/S stress test unavailable',
      evEbitdaStressMinus10 ? `If EBITDA misses by 10%: EV/EBITDA = ${evEbitdaStressMinus10}` : 'EV/EBITDA stress test unavailable',
    ],
    insights: [
      fmpData.forwardPS && fmpData.ttmPS
        ? `Forward P/S of ${fmpData.forwardPS} represents ${Math.round(((fmpData.forwardPS / fmpData.ttmPS - 1) * 100))}% ${fmpData.forwardPS < fmpData.ttmPS ? 'discount' : 'premium'} vs TTM`
        : 'Forward P/S comparison unavailable',
      fmpData.forwardEvEbitda !== null
        ? `Forward EV/EBITDA of ${fmpData.forwardEvEbitda}x based on ${fmpData.fiscalYear ?? 'FY'} analyst estimates`
        : 'Forward EV/EBITDA unavailable — no analyst EBITDA estimates',
      fmpData.analystCount ? `Consensus based on ${fmpData.analystCount} analyst estimates` : 'Analyst count unavailable',
    ],
    confidence_score: fmpData.available ? 0.9 : 0,
    data_freshness: fmpData.available ? 'CURRENT' : 'UNAVAILABLE',
  };

  setCached(cacheKey, result);
  return result;
}

async function runCustomerConcentration(symbol: string): Promise<unknown> {
  const cacheKey = `customer_concentration:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const profile = await getCompanyProfile(symbol);
  
  // Use deterministic SEC filing data instead of GPT/web search
  const secData = await getCustomerConcentrationData(symbol);

  if (!secData.available) {
    const result = {
      verdict: 'Unknown',
      concentration_pct: 'Customer concentration not publicly disclosed',
      top_customers: [],
      insights: [
        'Customer concentration data not found in recent 10-K filings',
        'Many companies do not disclose individual customer percentages',
        'Check MD&A or Risk Factors section of 10-K for qualitative discussion',
      ],
      confidence_score: 0.8, // High confidence that data is NOT available (vs low confidence that it IS available)
      data_freshness: 'CURRENT',
    };

    setCached(cacheKey, result);
    return result;
  }

  // Parse concentration percentage to determine risk level
  let verdict = 'Moderate Risk';
  if (secData.concentrationPct) {
    const match = secData.concentrationPct.match(/(\d+)%/);
    if (match) {
      const pct = parseInt(match[1], 10);
      if (pct >= 50) verdict = 'High Risk';
      else if (pct < 25) verdict = 'Low Risk';
    }
  }

  const result = {
    verdict,
    concentration_pct: secData.concentrationPct ?? DATA_NOT_AVAILABLE,
    top_customers: secData.topCustomers.length > 0 ? secData.topCustomers : [
      { rank: 'N/A', revenue_pct: DATA_NOT_AVAILABLE, trend: 'Unknown' },
    ],
    insights: [
      secData.concentrationPct
        ? `${secData.concentrationPct} disclosed in SEC filings`
        : 'Specific customer concentration percentages not disclosed',
      secData.source ?? 'Data source unavailable',
      secData.topCustomers.length > 0
        ? `Individual customer breakdown available for ${secData.topCustomers.length} customers`
        : 'Individual customer breakdown not disclosed',
    ],
    confidence_score: 0.95, // High confidence - data directly from SEC filings
    data_freshness: 'CURRENT',
  };

  setCached(cacheKey, result);
  return result;
}

async function runShortSellerPerspective(symbol: string): Promise<unknown> {
  const cacheKey = `short_seller_perspective:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const profile = await getCompanyProfile(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildShortSellerPerspectivePrompt(symbol, profile?.name ?? symbol),
      useWebSearch: true,
      section: 'short_seller_perspective',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('short_seller_perspective', raw);
  const confidence = buildQualitativeConfidence(validation);
  const data = validateSection(ShortSellerPerspectiveSchema, raw, 'short_seller_perspective');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score);

  setCached(cacheKey, result);
  return result;
}

async function runHistoricalPS(symbol: string): Promise<unknown> {
  const cacheKey = `historical_ps:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const verified = await getVerifiedFinancials(symbol);
  
  // Use deterministic historical valuation data instead of GPT/web search
  const histData = await getHistoricalPSData(symbol, verified.psTTM, verified.marketCapB);

  if (!histData.available || !histData.currentPS) {
    const result = {
      verdict: DATA_NOT_AVAILABLE,
      current_ps: verified.psTTM !== null ? String(Math.round(verified.psTTM * 10) / 10) : DATA_NOT_AVAILABLE,
      min_3y: DATA_NOT_AVAILABLE,
      max_3y: DATA_NOT_AVAILABLE,
      avg_3y: DATA_NOT_AVAILABLE,
      percentile: DATA_NOT_AVAILABLE,
      insights: ['Historical P/S analysis requires 3+ years of market cap and revenue data'],
      confidence_score: 0,
      data_freshness: 'UNAVAILABLE',
    };

    setCached(cacheKey, result);
    return result;
  }

  // Determine verdict based on percentile
  const verdict = histData.percentile !== null
    ? (histData.percentile < 25 ? 'At Historical Low'
       : histData.percentile > 75 ? 'At Historical High'
       : 'Mid-Range')
    : DATA_NOT_AVAILABLE;

  const result = {
    verdict,
    current_ps: String(histData.currentPS),
    min_3y: histData.min3y !== null ? String(histData.min3y) : DATA_NOT_AVAILABLE,
    max_3y: histData.max3y !== null ? String(histData.max3y) : DATA_NOT_AVAILABLE,
    avg_3y: histData.avg3y !== null ? String(histData.avg3y) : DATA_NOT_AVAILABLE,
    percentile: histData.percentile !== null ? `${histData.percentile}th percentile` : DATA_NOT_AVAILABLE,
    insights: [
      histData.percentile !== null
        ? `Current P/S of ${histData.currentPS} is at ${histData.percentile}th percentile of 3-year range`
        : 'Percentile ranking unavailable',
      histData.min3y && histData.max3y
        ? `Historical range: ${histData.min3y} (low) to ${histData.max3y} (high)`
        : 'Historical range unavailable',
      histData.avg3y
        ? `Current P/S is ${Math.round(((histData.currentPS / histData.avg3y - 1) * 100))}% ${histData.currentPS > histData.avg3y ? 'above' : 'below'} 3-year average`
        : 'Average comparison unavailable',
    ],
    confidence_score: histData.dataPoints >= 8 ? 0.9 : (histData.dataPoints >= 4 ? 0.7 : 0.4),
    data_freshness: 'CURRENT',
  };

  setCached(cacheKey, result);
  return result;
}

async function runInsiderOwnership(symbol: string): Promise<unknown> {
  const cacheKey = `insider_ownership:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const insiderData = await getInsiderOwnershipData(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildInsiderOwnershipPrompt(symbol, symbol, insiderData.totalInsiderPct, insiderData.insiderCount),
      useWebSearch: false,
      section: 'insider_ownership',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('insider_ownership', raw);
  const dataComp = insiderData.available ? 0.85 : 0.0;
  const confidence = buildDataDrivenConfidence(dataComp, validation);
  const data = validateSection(InsiderOwnershipSchema, raw, 'insider_ownership');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score, insiderData.available ? 'CURRENT' : 'UNAVAILABLE');

  setCached(cacheKey, result);
  return result;
}

async function runAsymmetryAnalysis(symbol: string): Promise<unknown> {
  const cacheKey = `asymmetry_analysis:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const verified = await getVerifiedFinancials(symbol);
  
  // Compute revenue per share for valuation bands
  const revenuePerShare = verified.marketCapB && verified.psTTM && verified.psTTM > 0
    ? (verified.marketCapB * 1e9) / (verified.sharesOutstanding ?? 1) / verified.psTTM
    : null;
  
  // Use deterministic valuation bands instead of GPT inference
  const asymData = await getAsymmetryValuationData(symbol, verified.price, verified.psTTM, revenuePerShare);

  if (!asymData.available) {
    const result = {
      verdict: DATA_NOT_AVAILABLE,
      downside_floor: DATA_NOT_AVAILABLE,
      upside_ceiling: DATA_NOT_AVAILABLE,
      risk_reward_ratio: DATA_NOT_AVAILABLE,
      base_case: ['Asymmetry analysis requires historical valuation ranges'],
      bull_case: ['Historical maximum P/S unavailable'],
      bear_case: ['Historical minimum P/S unavailable'],
      insights: ['Risk/reward calculation requires 3+ years of historical P/S data'],
      confidence_score: 0,
      data_freshness: 'UNAVAILABLE',
    };

    setCached(cacheKey, result);
    return result;
  }

  // Determine verdict based on risk/reward ratio
  const riskRewardRatio = asymData.bearCaseDownside && asymData.bullCaseUpside && asymData.bearCaseDownside < 0
    ? Math.abs(asymData.bullCaseUpside / asymData.bearCaseDownside)
    : null;

  const verdict = riskRewardRatio !== null
    ? (riskRewardRatio > 2.5 ? 'Highly Asymmetric'
       : riskRewardRatio < 1.5 ? 'Unfavorable'
       : 'Balanced')
    : DATA_NOT_AVAILABLE;

  const result = {
    verdict,
    downside_floor: asymData.bearCasePrice && asymData.bearCaseDownside !== null
      ? `$${asymData.bearCasePrice} (${asymData.bearCaseDownside.toFixed(1)}%)`
      : DATA_NOT_AVAILABLE,
    upside_ceiling: asymData.bullCasePrice && asymData.bullCaseUpside !== null
      ? `$${asymData.bullCasePrice} (+${asymData.bullCaseUpside.toFixed(1)}%)`
      : DATA_NOT_AVAILABLE,
    risk_reward_ratio: riskRewardRatio !== null ? `${riskRewardRatio.toFixed(1)}:1` : DATA_NOT_AVAILABLE,
    base_case: [
      asymData.fairValuePrice
        ? `Fair value at $${asymData.fairValuePrice} based on 3-year average P/S`
        : 'Fair value calculation unavailable',
      'Based on historical valuation multiples',
    ],
    bull_case: [
      asymData.bullCaseUpside !== null
        ? `${asymData.bullCaseUpside.toFixed(0)}% upside potential to historical high multiple`
        : 'Upside calculation unavailable',
      'Assumes reversion to historical maximum valuation',
    ],
    bear_case: [
      asymData.bearCaseDownside !== null
        ? `${Math.abs(asymData.bearCaseDownside).toFixed(0)}% downside risk to historical low multiple`
        : 'Downside calculation unavailable',
      'Assumes multiple compression to historical minimum',
    ],
    insights: [
      riskRewardRatio !== null
        ? `Risk/reward of ${riskRewardRatio.toFixed(1)}:1 suggests ${riskRewardRatio > 2 ? 'favorable' : riskRewardRatio < 1 ? 'unfavorable' : 'balanced'} asymmetry`
        : 'Risk/reward ratio unavailable',
      asymData.fairValuePrice && verified.price
        ? `Current price ${verified.price > asymData.fairValuePrice ? 'above' : 'below'} fair value by ${Math.abs(Math.round(((verified.price / asymData.fairValuePrice - 1) * 100)))}%`
        : 'Fair value comparison unavailable',
      'Valuation bands computed from 3-year historical P/S range',
    ],
    confidence_score: 0.85,
    data_freshness: 'CURRENT',
  };

  setCached(cacheKey, result);
  return result;
}

async function runRelativeStrength(symbol: string): Promise<unknown> {
  const cacheKey = `relative_strength:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const rs = await getRelativeStrengthData(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildRelativeStrengthPrompt(symbol, rs.return3m, rs.spyReturn3m, rs.rsVsSPY),
      useWebSearch: false,
      section: 'relative_strength',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('relative_strength', raw);
  const dataComp = rs.available ? 1.0 : 0.0;
  const confidence = buildDataDrivenConfidence(dataComp, validation);
  const data = validateSection(RelativeStrengthSchema, raw, 'relative_strength');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score, rs.available ? 'CURRENT' : 'UNAVAILABLE');

  setCached(cacheKey, result);
  return result;
}

async function runShortInterest(symbol: string): Promise<unknown> {
  const cacheKey = `short_interest:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const si = await getShortInterestData(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildShortInterestPrompt(symbol, si.shortInterestPct, si.daysToCover, si.reportDate),
      useWebSearch: false,
      section: 'short_interest',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('short_interest', raw);
  const dataComp = si.available ? 0.8 : 0.0;
  const confidence = buildDataDrivenConfidence(dataComp, validation);
  const data = validateSection(ShortInterestSchema, raw, 'short_interest');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score, si.available ? 'CURRENT' : 'UNAVAILABLE');

  setCached(cacheKey, result);
  return result;
}

async function runRetailSentiment(symbol: string): Promise<unknown> {
  const cacheKey = `retail_sentiment:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildRetailSentimentPrompt(symbol),
      useWebSearch: true,
      section: 'retail_sentiment',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('retail_sentiment', raw);
  const confidence = buildQualitativeConfidence(validation);
  const data = validateSection(RetailSentimentSchema, raw, 'retail_sentiment');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score);

  setCached(cacheKey, result);
  return result;
}

async function runVolumePatterns(symbol: string): Promise<unknown> {
  const cacheKey = `volume_patterns:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const vol = await getVolumePatternData(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildVolumePatternsPrompt(symbol, vol.avgVolume30d, vol.currentVolume, vol.volumeRatio, vol.highVolumeDays, vol.available),
      useWebSearch: false,
      section: 'volume_patterns',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('volume_patterns', raw);
  const dataComp = vol.available ? 0.9 : 0.0;
  const confidence = buildDataDrivenConfidence(dataComp, validation);
  const data = validateSection(VolumePatternsSchema, raw, 'volume_patterns');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score, vol.available ? 'CURRENT' : 'UNAVAILABLE');

  setCached(cacheKey, result);
  return result;
}

async function runBullCaseCritique(symbol: string): Promise<unknown> {
  const cacheKey = `bull_case_critique:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const profile = await getCompanyProfile(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildBullCaseCritiquePrompt(symbol, profile?.name ?? symbol),
      useWebSearch: true,
      section: 'bull_case_critique',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('bull_case_critique', raw);
  const confidence = buildQualitativeConfidence(validation);
  const data = validateSection(BullCaseCritiqueSchema, raw, 'bull_case_critique');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score);

  setCached(cacheKey, result);
  return result;
}

async function runEarningsMiss(symbol: string): Promise<unknown> {
  const cacheKey = `earnings_miss:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const earnings = await getEarningsSurprisesData(symbol);
  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildEarningsMissPrompt(symbol, earnings.surprises, earnings.recentMisses),
      useWebSearch: false,
      section: 'earnings_miss',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('earnings_miss', raw);
  const dataComp = earnings.available ? 0.9 : 0.0;
  const confidence = buildDataDrivenConfidence(dataComp, validation);
  const data = validateSection(EarningsMissSchema, raw, 'earnings_miss');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score, earnings.available ? 'CURRENT' : 'UNAVAILABLE');

  setCached(cacheKey, result);
  return result;
}

async function runImpliedVolatility(symbol: string): Promise<unknown> {
  const cacheKey = `implied_volatility:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const week52 = await getWeek52Data(symbol);
  const hv30 = week52?.closes ? computeHistoricalVolatility(week52.closes, 30) : null;

  const raw = await withTimeout(
    withRetry(() => callGPT({
      prompt: buildImpliedVolatilityPrompt(symbol, hv30),
      useWebSearch: false,
      section: 'implied_volatility',
      symbol,
    })),
    SECTION_TIMEOUT_MS,
  );

  const validation = validateAIOutput('implied_volatility', raw);
  const dataComp = hv30 !== null ? 0.7 : 0.0;
  const confidence = buildDataDrivenConfidence(dataComp, validation);
  const data = validateSection(ImpliedVolatilitySchema, raw, 'implied_volatility');
  const result = withConfidence(data as unknown as Record<string, unknown>, confidence.score, hv30 !== null ? 'CURRENT' : 'UNAVAILABLE');

  setCached(cacheKey, result);
  return result;
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

export async function runResearchPipeline(symbol: string, emit: Emit, tier: ResearchTier = 'basic'): Promise<void> {
  const profile = await getCompanyProfile(symbol);
  const companyName = profile?.name ?? symbol;

  const verdictCacheKey = `verdict:${symbol}:${tier}`;
  const cachedVerdict = getCached(verdictCacheKey);

  const allSectionKeys: SectionSSEKey[] = TIER_SECTIONS[tier];
  const sectionCacheKeys: Partial<Record<SectionSSEKey, string>> = {
    research_foundation: `foundation:${symbol}`,
    valuation_financials: `valuation:${symbol}`,
    risk_red_teaming: `risks:${symbol}`,
    technicals: `technicals:${symbol}`,
  };

  const allCached = allSectionKeys.every(k => {
    const cacheKey = sectionCacheKeys[k];
    return cacheKey ? getCached(cacheKey) !== null : false;
  });

  if (allCached && cachedVerdict) {
    for (const key of allSectionKeys) {
      const cacheKey = sectionCacheKeys[key];
      if (cacheKey) emit('section', { key, status: 'success', data: getCached(cacheKey) });
    }
    emit('verdict', { status: 'success', data: cachedVerdict as AIVerdict });
    emit('done', {});
    return;
  }

  const sectionPromises = allSectionKeys.map(async (key): Promise<[SectionSSEKey, PromiseSettledResult<unknown>]> => {
    const cacheKey = sectionCacheKeys[key];
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) return [key, { status: 'fulfilled', value: cached }] as const;
    }

    try {
      let result: unknown;
      switch (key) {
        case 'research_foundation':      result = await runFoundation(symbol); break;
        case 'valuation_financials':     result = await runValuation(symbol); break;
        case 'risk_red_teaming':         result = await runRisks(symbol); break;
        case 'technicals':               result = await runTechnicals(symbol); break;
        case 'peer_comparison':          result = await runPeerComparison(symbol); break;
        case 'rule_of_40':               result = await runRuleOf40(symbol); break;
        case 'forward_ps':               result = await runForwardPS(symbol); break;
        case 'customer_concentration':   result = await runCustomerConcentration(symbol); break;
        case 'short_seller_perspective': result = await runShortSellerPerspective(symbol); break;
        case 'historical_ps':            result = await runHistoricalPS(symbol); break;
        case 'insider_ownership':        result = await runInsiderOwnership(symbol); break;
        case 'asymmetry_analysis':       result = await runAsymmetryAnalysis(symbol); break;
        case 'relative_strength':        result = await runRelativeStrength(symbol); break;
        case 'short_interest':           result = await runShortInterest(symbol); break;
        case 'retail_sentiment':         result = await runRetailSentiment(symbol); break;
        case 'volume_patterns':          result = await runVolumePatterns(symbol); break;
        case 'bull_case_critique':       result = await runBullCaseCritique(symbol); break;
        case 'earnings_miss':            result = await runEarningsMiss(symbol); break;
        case 'implied_volatility':       result = await runImpliedVolatility(symbol); break;
        default: throw new Error(`Section ${key} not implemented`);
      }
      return [key, { status: 'fulfilled', value: result }] as const;
    } catch (error) {
      return [key, { status: 'rejected', reason: error }] as const;
    }
  });

  const results = await Promise.all(sectionPromises);

  const coreNormalized: Record<string, NormalizedModuleOutput> = {};
  const additionalNormalized: Record<string, NormalizedModuleOutput> = {};

  for (const [key, result] of results) {
    if (result.status === 'fulfilled') {
      emit('section', { key, status: 'success', data: result.value });
      if (key === 'research_foundation') coreNormalized[key] = normalizeFoundation(result.value as unknown as AIResearchFoundation);
      else if (key === 'valuation_financials') coreNormalized[key] = normalizeValuation(result.value as unknown as AIValuationFinancials);
      else if (key === 'risk_red_teaming') coreNormalized[key] = normalizeRisks(result.value as unknown as AIRiskRedTeaming);
      else if (key === 'technicals') coreNormalized[key] = normalizeTechnicals(result.value as unknown as AITechnicals);
      else additionalNormalized[key] = normalizeGenericSection(result.value as unknown as Record<string, unknown>);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : 'Module failed';
      emit('section', { key, status: 'error', error: message });
      console.error(`[orchestrator:${key}] symbol=${symbol} tier=${tier} error=${message}`);
    }
  }

  const coreSucceeded = ['research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals']
    .every(k => coreNormalized[k] !== undefined);
  if (!coreSucceeded) {
    emit('verdict', { status: 'error', error: 'Verdict skipped: one or more core modules failed' });
    emit('done', {});
    return;
  }

  // ─── VERDICT FILTERING: Remove unverified claims before synthesis ────────────
  // Convert NormalizedModuleOutput to FilteredVerdictInput format
  const coreForFiltering: Record<string, FilteredVerdictInput> = {};
  for (const [key, module] of Object.entries(coreNormalized)) {
    coreForFiltering[key] = {
      sectionKey: key,
      bullPoints: module.bullPoints,
      bearPoints: module.bearPoints,
      verdict: module.verdict,
      score: module.score,
      confidence: module.confidence,
    };
  }

  const additionalForFiltering: Record<string, FilteredVerdictInput> = {};
  for (const [key, module] of Object.entries(additionalNormalized)) {
    additionalForFiltering[key] = {
      sectionKey: key,
      bullPoints: module.bullPoints,
      bearPoints: module.bearPoints,
      verdict: module.verdict,
      score: module.score,
      confidence: module.confidence,
    };
  }

  // Filter out unverified claims from all modules
  const { filtered: filteredCore, allRemovedClaims: coreRemoved } = filterAllModulesForVerdict(coreForFiltering);
  const { filtered: filteredAdditional, allRemovedClaims: additionalRemoved } = filterAllModulesForVerdict(additionalForFiltering);

  const totalRemoved = coreRemoved.length + additionalRemoved.length;
  if (totalRemoved > 0) {
    console.warn(`[orchestrator:verdict] ${symbol} — filtered ${totalRemoved} unverified claims before synthesis`);
  }

  // Convert back to NormalizedModuleOutput format for the prompt builder
  const filteredCoreNormalized: Record<string, NormalizedModuleOutput> = {};
  for (const [key, filtered] of Object.entries(filteredCore)) {
    filteredCoreNormalized[key] = {
      verdict: filtered.verdict,
      bullPoints: filtered.bullPoints,
      bearPoints: filtered.bearPoints,
      score: filtered.score,
      confidence: filtered.confidence,
    };
  }

  const filteredAdditionalNormalized: Record<string, NormalizedModuleOutput> = {};
  for (const [key, filtered] of Object.entries(filteredAdditional)) {
    filteredAdditionalNormalized[key] = {
      verdict: filtered.verdict,
      bullPoints: filtered.bullPoints,
      bearPoints: filtered.bearPoints,
      score: filtered.score,
      confidence: filtered.confidence,
    };
  }

  try {
    const rawVerdict = await withTimeout(
      withRetry(() => callGPT({
        prompt: buildVerdictFromModulesPrompt(symbol, companyName, filteredCoreNormalized,
          Object.keys(filteredAdditionalNormalized).length > 0 ? filteredAdditionalNormalized : undefined),
        useWebSearch: false,
        section: 'verdict',
        symbol,
      })),
      SECTION_TIMEOUT_MS,
    );
    const verdictData = validateSection(VerdictSchema, rawVerdict, 'verdict') as AIVerdict;
    setCached(verdictCacheKey, verdictData);
    emit('verdict', { status: 'success', data: verdictData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verdict generation failed';
    console.error(`[orchestrator:verdict] symbol=${symbol} error=${message}`);
    emit('verdict', { status: 'error', error: message });
  }

  emit('done', {});
}
