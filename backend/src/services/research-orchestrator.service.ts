import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { getQuote, getCompanyProfile, getWeek52Data, getBasicFinancials } from './finnhub.service';
import { calculateRSI } from './rsi.service';
import { calculateDMA } from './dma.service';
import { calculateSupportResistance } from './support-resistance.service';
import { getCached, setCached } from './research-cache';
import { withRetry, withTimeout } from '../utils/retry';
import { AI_CONFIG } from '../config/ai.config';
import {
  FoundationSchema,
  ValuationSchema,
  RisksSchema,
  TechnicalsSchema,
  VerdictSchema,
  validateSection,
} from '../schemas/ai-sections';

// Local type definitions (mirrors lib/ai-types.ts shapes)
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NormalizedModuleOutput {
  verdict: string;
  bullPoints: string[];
  bearPoints: string[];
  score: number;
  confidence: number;
}

export type SectionSSEKey = 'research_foundation' | 'valuation_financials' | 'risk_red_teaming' | 'technicals';

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

export type EmitFn = (event: 'section', payload: SectionEvent) => void
  | ((event: 'verdict', payload: VerdictEvent) => void)
  | ((event: 'done', payload: Record<string, never>) => void)
  | ((event: 'error', payload: { message: string }) => void);

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

// ─── GPT helpers ──────────────────────────────────────────────────────────────

async function callGPT(opts: {
  prompt: string;
  useWebSearch: boolean;
  section: string;
  symbol: string;
}): Promise<unknown> {
  const { prompt, useWebSearch, section, symbol } = opts;
  const client = getOpenAI();
  const start = Date.now();
  let text: string;

  if (useWebSearch) {
    const model = AI_CONFIG.webSearchModel;
    const response = await client.responses.create({
      model,
      tools: [{ type: 'web_search_preview' }],
      max_output_tokens: AI_CONFIG.maxOutputTokens,
      input: [
        {
          role: 'system',
          content: 'You are a professional equity research analyst with access to real-time web search. Use web search to retrieve the latest news, filings, and analyst data before responding. Return ONLY valid JSON with no markdown, code fences, or commentary.',
        },
        { role: 'user', content: prompt },
      ] as ResponseInputItem[],
    });
    text = response.output_text ?? '{}';
    console.log(`[orchestrator:${section}] symbol=${symbol} model=${model} webSearch=true latencyMs=${Date.now() - start}`);
  } else {
    const model = AI_CONFIG.chatModel;
    const response = await client.chat.completions.create({
      model,
      stream: false,
      temperature: AI_CONFIG.temperature,
      max_completion_tokens: AI_CONFIG.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a professional equity research analyst. Use only the structured data provided. Return ONLY valid JSON with no markdown, code fences, or commentary.',
        },
        { role: 'user', content: prompt },
      ] as ChatCompletionMessageParam[],
    });
    text = response.choices[0]?.message?.content ?? '{}';
    console.log(`[orchestrator:${section}] symbol=${symbol} model=${model} webSearch=false latencyMs=${Date.now() - start}`);
  }

  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error(`Invalid JSON response for section ${section}`);
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildFoundationPrompt(symbol: string, companyName: string, industry: string): string {
  return `Analyze ${symbol} (${companyName}, industry: ${industry}) for its research foundation. Use web search for latest data.
Return JSON with exactly these fields. All array string items must be plain text, no URLs, no markdown, max 15 words each:
{"verdict":"Strong"|"Moderate"|"Weak","business_model":["bullet1","bullet2","bullet3"],"moat":["bullet1","bullet2","bullet3"],"catalysts":["bullet1","bullet2","bullet3"],"asymmetry":["bullet1","bullet2"],"insights":["insight1","insight2","insight3","insight4"]}`;
}

function buildValuationPrompt(
  symbol: string,
  companyName: string,
  price: number,
  marketCap: number | null,
  metrics: Record<string, unknown>
): string {
  return `Analyze ${symbol} (${companyName}) valuation. Use web search to find the most recent values for any metric that is N/A below.
Price: $${price}
Market Cap: ${marketCap ? `$${(marketCap / 1000).toFixed(1)}B` : 'N/A'}
Available metrics (use web search to fill in N/A values): ${JSON.stringify(metrics)}

All array string items must be plain text, no URLs, no markdown, max 15 words each.
Return JSON with exactly these fields:
{"verdict":"Positive"|"Neutral"|"Negative","relative_valuation":["bullet1","bullet2","bullet3"],"growth_metrics":["bullet1","bullet2","bullet3"],"financial_health":["bullet1","bullet2","bullet3"],"metrics":[{"label":"P/E Ratio","value":"<real value or N/A>","note":"vs sector avg"},{"label":"Revenue Growth","value":"<real value or N/A>","note":"TTM YoY"},{"label":"Gross Margin","value":"<real value or N/A>","note":"TTM"},{"label":"Free Cash Flow","value":"<real value or N/A>","note":"TTM"},{"label":"Debt/Equity","value":"<real value or N/A>","note":"leverage"},{"label":"EV/EBITDA","value":"<real value or N/A>","note":"vs sector"},{"label":"ROE","value":"<real value or N/A>","note":"TTM"},{"label":"Current Ratio","value":"<real value or N/A>","note":"liquidity"}]}`;
}

function buildRiskPrompt(symbol: string, companyName: string): string {
  return `Analyze risks for ${symbol} (${companyName}). Include bear case, regulatory/SEC risks, and customer concentration. Use web search for latest data.
All array string items must be plain text, no URLs, no markdown, max 15 words each.
Return JSON with exactly these fields:
{"verdict":"Low"|"Moderate"|"Elevated"|"High","bear_case":["bullet1","bullet2","bullet3"],"sec_flags":["bullet1","bullet2","bullet3"],"customer_concentration":["bullet1","bullet2"],"risks":[{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"},{"label":"Risk name","description":"1 short sentence max 15 words"}]}`;
}

function buildTechnicalsPrompt(
  symbol: string, price: number,
  rsi: number | null, rsiTrend: string | null,
  ma50: number | null, ma200: number | null,
  support: number | null, resistance: number | null,
  high52w: number | null, low52w: number | null
): string {
  return `Interpret the technical picture for ${symbol} using this real market data:
Price: $${price}
RSI-14: ${rsi ?? 'N/A'} (trend: ${rsiTrend ?? 'N/A'})
50-day MA: ${ma50 ? `$${ma50.toFixed(2)}` : 'N/A'} (price is ${ma50 ? (price > ma50 ? 'above' : 'below') : 'N/A'})
200-day MA: ${ma200 ? `$${ma200.toFixed(2)}` : 'N/A'} (price is ${ma200 ? (price > ma200 ? 'above' : 'below') : 'N/A'})
Support: ${support ? `$${support.toFixed(2)}` : 'N/A'}
Resistance: ${resistance ? `$${resistance.toFixed(2)}` : 'N/A'}
52-week High: ${high52w ? `$${high52w.toFixed(2)}` : 'N/A'}
52-week Low: ${low52w ? `$${low52w.toFixed(2)}` : 'N/A'}

All array string items must be plain text, no URLs, no markdown, max 15 words each.
Return JSON with exactly these fields:
{"verdict":"Bullish"|"Neutral"|"Bearish","price_trend":["bullet1","bullet2"],"moving_averages":["bullet1","bullet2"],"rsi":["bullet1","bullet2"],"support_resistance":["bullet1","bullet2"],"technical_view":["bullet1","bullet2"]}`;
}

export function buildVerdictFromModulesPrompt(
  symbol: string,
  companyName: string,
  modules: Record<SectionSSEKey, NormalizedModuleOutput>
): string {
  const sections = (Object.entries(modules) as [SectionSSEKey, NormalizedModuleOutput][])
    .map(([key, m]) => {
      const label = key.replace(/_/g, ' ');
      return `${label} (verdict: ${m.verdict}, score: ${m.score}/100, confidence: ${(m.confidence * 100).toFixed(0)}%):
  Bull: ${m.bullPoints.join(' | ')}
  Bear: ${m.bearPoints.join(' | ')}`;
    })
    .join('\n\n');

  return `Synthesize an overall investment verdict for ${symbol} (${companyName}) based on these completed research module outputs:

${sections}

Do NOT do web search. Use only the above data to form your synthesis.
All array string items must be plain text, no URLs, no markdown, max 15 words each.
Return JSON with exactly these fields:
{"overall":"Strongly Bullish"|"Moderately Bullish"|"Neutral"|"Moderately Bearish"|"Strongly Bearish","summary":["bullet1","bullet2","bullet3"],"key_drivers":["driver1","driver2","driver3"],"key_risks":["risk1","risk2","risk3"],"catalysts":["catalyst1","catalyst2","catalyst3"]}`;
}

// ─── Normalization ────────────────────────────────────────────────────────────

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

// ─── Module runners ───────────────────────────────────────────────────────────

async function runFoundation(symbol: string): Promise<AIResearchFoundation> {
  const cacheKey = `foundation:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AIResearchFoundation;

  const profile = await getCompanyProfile(symbol);
  const raw = await withTimeout(
    withRetry(() =>
      callGPT({
        prompt: buildFoundationPrompt(symbol, profile?.name ?? symbol, profile?.industry ?? ''),
        useWebSearch: true,
        section: 'foundation',
        symbol,
      })
    ),
    SECTION_TIMEOUT_MS
  );
  const data = validateSection(FoundationSchema, raw, 'foundation') as AIResearchFoundation;
  setCached(cacheKey, data);
  return data;
}

async function runValuation(symbol: string): Promise<AIValuationFinancials> {
  const cacheKey = `valuation:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AIValuationFinancials;

  const [quote, profile, financials] = await Promise.all([
    getQuote(symbol),
    getCompanyProfile(symbol),
    getBasicFinancials(symbol),
  ]);
  const raw = await withTimeout(
    withRetry(() =>
      callGPT({
        prompt: buildValuationPrompt(
          symbol,
          profile?.name ?? symbol,
          quote.currentPrice ?? 0,
          profile?.marketCap ?? null,
          (financials ?? {}) as Record<string, unknown>
        ),
        useWebSearch: true,
        section: 'valuation',
        symbol,
      })
    ),
    SECTION_TIMEOUT_MS
  );
  const data = validateSection(ValuationSchema, raw, 'valuation') as AIValuationFinancials;
  setCached(cacheKey, data);
  return data;
}

async function runRisks(symbol: string): Promise<AIRiskRedTeaming> {
  const cacheKey = `risks:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AIRiskRedTeaming;

  const profile = await getCompanyProfile(symbol);
  const raw = await withTimeout(
    withRetry(() =>
      callGPT({
        prompt: buildRiskPrompt(symbol, profile?.name ?? symbol),
        useWebSearch: true,
        section: 'risks',
        symbol,
      })
    ),
    SECTION_TIMEOUT_MS
  );
  const data = validateSection(RisksSchema, raw, 'risks') as AIRiskRedTeaming;
  setCached(cacheKey, data);
  return data;
}

async function runTechnicals(symbol: string): Promise<AITechnicals> {
  const cacheKey = `technicals:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as AITechnicals;

  const [quote, week52] = await Promise.all([getQuote(symbol), getWeek52Data(symbol)]);
  const price = quote.currentPrice ?? 0;
  const rsiResult = week52?.closes ? calculateRSI(week52.closes) : null;
  const dmaResult = week52?.closes ? calculateDMA(week52.closes, price) : null;
  const srResult =
    week52?.recentHighs && week52.recentLows
      ? calculateSupportResistance(week52.recentLows, week52.recentHighs, price)
      : null;

  const raw = await withTimeout(
    withRetry(() =>
      callGPT({
        prompt: buildTechnicalsPrompt(
          symbol, price,
          rsiResult?.rsi ?? null, rsiResult?.rsiTrend ?? null,
          dmaResult?.ma50 ?? null, dmaResult?.ma200 ?? null,
          srResult?.support ?? null, srResult?.resistance ?? null,
          week52?.high52w ?? null, week52?.low52w ?? null
        ),
        useWebSearch: false,
        section: 'technicals',
        symbol,
      })
    ),
    SECTION_TIMEOUT_MS
  );
  const data = validateSection(TechnicalsSchema, raw, 'technicals') as AITechnicals;
  setCached(cacheKey, data);
  return data;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runResearchPipeline(symbol: string, emit: Emit): Promise<void> {
  const profile = await getCompanyProfile(symbol);
  const companyName = profile?.name ?? symbol;

  const verdictCacheKey = `verdict:${symbol}`;
  const cachedVerdict = getCached(verdictCacheKey);

  // Fast path: all sections and verdict are cached
  const allSectionKeys: SectionSSEKey[] = [
    'research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals',
  ];
  const sectionCacheKeys: Record<SectionSSEKey, string> = {
    research_foundation: `foundation:${symbol}`,
    valuation_financials: `valuation:${symbol}`,
    risk_red_teaming: `risks:${symbol}`,
    technicals: `technicals:${symbol}`,
  };

  const allCached = allSectionKeys.every(k => getCached(sectionCacheKeys[k]) !== null);
  if (allCached && cachedVerdict) {
    for (const key of allSectionKeys) {
      emit('section', { key, status: 'success', data: getCached(sectionCacheKeys[key]) });
    }
    emit('verdict', { status: 'success', data: cachedVerdict as AIVerdict });
    emit('done', {});
    return;
  }

  // Run all 4 modules in parallel
  const [foundationResult, valuationResult, risksResult, technicalsResult] =
    await Promise.allSettled([
      runFoundation(symbol),
      runValuation(symbol),
      runRisks(symbol),
      runTechnicals(symbol),
    ]);

  const results: [SectionSSEKey, PromiseSettledResult<unknown>][] = [
    ['research_foundation', foundationResult],
    ['valuation_financials', valuationResult],
    ['risk_red_teaming', risksResult],
    ['technicals', technicalsResult],
  ];

  const normalized: Partial<Record<SectionSSEKey, NormalizedModuleOutput>> = {};

  for (const [key, result] of results) {
    if (result.status === 'fulfilled') {
      emit('section', { key, status: 'success', data: result.value });
      // normalize for verdict synthesis
      if (key === 'research_foundation') normalized[key] = normalizeFoundation(result.value as AIResearchFoundation);
      if (key === 'valuation_financials') normalized[key] = normalizeValuation(result.value as AIValuationFinancials);
      if (key === 'risk_red_teaming') normalized[key] = normalizeRisks(result.value as AIRiskRedTeaming);
      if (key === 'technicals') normalized[key] = normalizeTechnicals(result.value as AITechnicals);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : 'Module failed';
      emit('section', { key, status: 'error', error: message });
      console.error(`[orchestrator:${key}] symbol=${symbol} error=${message}`);
    }
  }

  // Only generate verdict if all 4 modules succeeded
  const allSucceeded = allSectionKeys.every(k => normalized[k] !== undefined);
  if (!allSucceeded) {
    emit('verdict', { status: 'error', error: 'Verdict skipped: one or more modules failed' });
    emit('done', {});
    return;
  }

  try {
    const rawVerdict = await withTimeout(
      withRetry(() =>
        callGPT({
          prompt: buildVerdictFromModulesPrompt(
            symbol,
            companyName,
            normalized as Record<SectionSSEKey, NormalizedModuleOutput>
          ),
          useWebSearch: false,
          section: 'verdict',
          symbol,
        })
      ),
      SECTION_TIMEOUT_MS
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
