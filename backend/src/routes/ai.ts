import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { getQuote, getCompanyProfile, getWeek52Data, getBasicFinancials } from '../services/finnhub.service';
import { calculateRSI } from '../services/rsi.service';
import { calculateDMA } from '../services/dma.service';
import { calculateSupportResistance } from '../services/support-resistance.service';
import { getCached, setCached } from '../services/research-cache';
import { withRetry, withTimeout } from '../utils/retry';
import { AI_CONFIG, ANTI_HALLUCINATION_SYSTEM_PROMPT, QUALITATIVE_WEBSEARCH_SYSTEM_PROMPT } from '../config/ai.config';
import { logAIResearch } from '../services/ai-research-logger.service';
import { getCompetitors } from '../config/competitors.config';
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
} from '../services/market-data.service';
import { validateAIOutput, validateFinancialInputs, sanitizeAIOutput } from '../services/validation.service';
import { normalizePercent } from '../utils/normalize-percent';
import { buildDataDrivenConfidence, buildQualitativeConfidence } from '../services/confidence.service';
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
import {
  runResearchPipeline,
  buildVerdictFromModulesPrompt,
  normalizeFoundation,
  normalizeValuation,
  normalizeRisks,
  normalizeTechnicals,
} from '../services/research-orchestrator.service';
import { generateMarkdownReport } from '../services/markdown-report.service';
import type {
  AIResearchFoundation as OrchestratorFoundation,
  AIValuationFinancials as OrchestratorValuation,
  AIRiskRedTeaming as OrchestratorRisks,
  AITechnicals as OrchestratorTechnicals,
  SectionSSEKey,
  NormalizedModuleOutput,
} from '../services/research-orchestrator.service';

const router = Router();

const SYMBOL_RE = /^[A-Z0-9:.\-^]{1,20}$/;
const SECTION_TIMEOUT_MS = AI_CONFIG.sectionTimeoutMs;

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

interface OpenAICallOptions {
  prompt: string;
  useWebSearch: boolean;
  section: string;
  symbol: string;
  systemPrompt?: string;
}

async function callGPT({ prompt, useWebSearch, section, symbol, systemPrompt }: OpenAICallOptions): Promise<unknown> {
  const client = getOpenAI();
  const start = Date.now();
  let text: string;
  let model: string;
  let promptTokens: number | string = '?';
  let completionTokens: number | string = '?';

  const resolvedSystem = systemPrompt ?? (
    useWebSearch ? QUALITATIVE_WEBSEARCH_SYSTEM_PROMPT : ANTI_HALLUCINATION_SYSTEM_PROMPT
  );

  if (useWebSearch) {
    model = AI_CONFIG.webSearchModel;
    const response = await client.responses.create({
      model,
      tools: [{ type: 'web_search_preview' }],
      max_output_tokens: AI_CONFIG.maxOutputTokens,
      input: [
        { role: 'system', content: resolvedSystem },
        { role: 'user', content: prompt },
      ] as ResponseInputItem[],
    });
    text = response.output_text ?? '{}';
    promptTokens = response.usage?.input_tokens ?? '?';
    completionTokens = response.usage?.output_tokens ?? '?';
    console.log(`[ai:${section}] symbol=${symbol} model=${model} webSearch=true promptTokens=${promptTokens} completionTokens=${completionTokens} latencyMs=${Date.now() - start} outputTextLen=${text.length}`);
  } else {
    model = AI_CONFIG.chatModel;
    const response = await client.chat.completions.create({
      model,
      stream: false,
      temperature: AI_CONFIG.temperature,
      max_completion_tokens: AI_CONFIG.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: resolvedSystem },
        { role: 'user', content: prompt },
      ] as ChatCompletionMessageParam[],
    });
    const choice = response.choices[0];
    text = choice?.message?.content ?? '{}';
    promptTokens = response.usage?.prompt_tokens ?? '?';
    completionTokens = response.usage?.completion_tokens ?? '?';
    console.log(`[ai:${section}] symbol=${symbol} model=${model} webSearch=false promptTokens=${promptTokens} completionTokens=${completionTokens} finishReason=${choice?.finish_reason} latencyMs=${Date.now() - start} textLen=${text.length}`);
  }

  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const latencyMs = Date.now() - start;
  let parsedData: unknown;

  try {
    parsedData = JSON.parse(stripped);
  } catch {
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch {
        console.error(`[ai:${section}] symbol=${symbol} FULL raw response:\n---\n${text}\n---`);
        throw new Error(`Invalid JSON response for section ${section}`);
      }
    } else {
      console.error(`[ai:${section}] symbol=${symbol} FULL raw response:\n---\n${text}\n---`);
      throw new Error(`Invalid JSON response for section ${section}`);
    }
  }

  logAIResearch({
    timestamp: new Date().toISOString(),
    symbol, section, model, useWebSearch, prompt,
    rawResponse: text, parsedData, latencyMs, promptTokens, completionTokens,
  }).catch(err => {
    console.error(`[ai:${section}] Failed to log research: ${err instanceof Error ? err.message : err}`);
  });

  return parsedData;
}

// ─── Helper: inject confidence and validation warnings ────────────────────────

function withConfidence<T extends Record<string, unknown>>(
  data: T,
  score: number,
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE' = 'CURRENT',
  validationWarnings: string[] = [],
): T & { validation_warnings?: string[] } {
  const result: T & { confidence_score: number; data_freshness: string; validation_warnings?: string[] } = {
    ...data,
    confidence_score: score,
    data_freshness: freshness,
  };
  if (validationWarnings.length > 0) {
    result.validation_warnings = validationWarnings;
  }
  return result;
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
    v !== null ? `${Math.round(v * 100) / 100}${suffix}` : 'DATA_NOT_AVAILABLE';
  const fmtPct = (v: number | null) => normalizePercent(v).display;

  return `Interpret the valuation picture for ${symbol} (${companyName}).

Using ONLY the VERIFIED STRUCTURED DATA below — do NOT search for or invent additional values.

VERIFIED STRUCTURED DATA [source: Finnhub API]:
- Price: $${price}
- Market Cap: ${marketCapB !== null ? `$${marketCapB}B` : 'DATA_NOT_AVAILABLE'}
- P/E Ratio (TTM): ${fmt(metrics.peRatioTTM)}
- P/S Ratio (TTM): ${fmt(metrics.psTTM)}
- EV/EBITDA (TTM): ${fmt(metrics.evEbitdaTTM)}
- ROE (TTM): ${fmtPct(metrics.roeTTM)}
- Revenue Growth YoY (TTM): ${fmtPct(metrics.revenueGrowthTTMYoy)}
- Gross Margin (TTM): ${fmtPct(metrics.grossMarginTTM)}
- Net Margin (TTM): ${fmtPct(metrics.netProfitMarginTTM)}
- Debt/Equity: ${fmt(metrics.debtEquityTTM)}
- Current Ratio: ${fmt(metrics.currentRatioTTM)}
- Free Cash Flow (TTM): ${metrics.freeCashFlowTTM !== null ? `$${Math.round(metrics.freeCashFlowTTM / 1e6)}M` : 'DATA_NOT_AVAILABLE'}

RULES:
- Use ONLY the above values
- For the metrics array, use exactly the values provided (do NOT substitute DATA_NOT_AVAILABLE)
- All string items must be plain text, no URLs, no markdown, max 15 words each

Return JSON:
{"verdict":"Positive"|"Neutral"|"Negative","relative_valuation":["bullet1","bullet2","bullet3"],"growth_metrics":["bullet1","bullet2","bullet3"],"financial_health":["bullet1","bullet2","bullet3"],"metrics":[{"label":"P/E Ratio","value":"${fmt(metrics.peRatioTTM)}","note":"vs sector avg"},{"label":"Revenue Growth","value":"${fmtPct(metrics.revenueGrowthTTMYoy)}","note":"TTM YoY"},{"label":"Gross Margin","value":"${fmtPct(metrics.grossMarginTTM)}","note":"TTM"},{"label":"Free Cash Flow","value":"${metrics.freeCashFlowTTM !== null ? `$${Math.round(metrics.freeCashFlowTTM / 1e6)}M` : 'DATA_NOT_AVAILABLE'}","note":"TTM"},{"label":"Debt/Equity","value":"${fmt(metrics.debtEquityTTM)}","note":"leverage"},{"label":"EV/EBITDA","value":"${fmt(metrics.evEbitdaTTM)}","note":"vs sector"},{"label":"ROE","value":"${fmtPct(metrics.roeTTM)}","note":"TTM"},{"label":"Current Ratio","value":"${fmt(metrics.currentRatioTTM)}","note":"liquidity"}]}`;
}

function buildRiskPrompt(symbol: string, companyName: string, industry: string): string {
  return `Analyze risks for ${symbol} (${companyName}, industry: ${industry}).

You MAY use web search for recent regulatory developments and competitive threats.

CRITICAL RULES:
- STRICTLY PROHIBITED: Do NOT fabricate SEC investigations, legal proceedings, or customer names/percentages
- Do NOT state company/customer relationships as verified facts
- Use hedged language: "Reported relationships with large AI infrastructure customers" instead of "Major contracts with Meta and Microsoft"
- Customer/partner claims MUST come from: SEC filings, official press releases, or company IR pages
- If customer concentration is not publicly disclosed, state "Customer concentration not publicly disclosed"

VERIFIED STRUCTURED DATA:
- Symbol: ${symbol}
- Company: ${companyName}
- Industry: ${industry}

Return JSON. All string items must be plain text, no URLs, no markdown, max 15 words each.
For sec_flags: only include if clearly documented in SEC filings. For customer_concentration: only if publicly disclosed in official filings.

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

VERIFIED STRUCTURED DATA [source: computed from Finnhub/Yahoo Finance]:
- Price: $${price}
- RSI-14: ${rsi ?? 'DATA_NOT_AVAILABLE'} (trend: ${rsiTrend ?? 'DATA_NOT_AVAILABLE'})
- 50-day MA: ${ma50 ? `$${ma50.toFixed(2)} (price is ${price > ma50 ? 'above' : 'below'})` : 'DATA_NOT_AVAILABLE'}
- 200-day MA: ${ma200 ? `$${ma200.toFixed(2)} (price is ${price > ma200 ? 'above' : 'below'})` : 'DATA_NOT_AVAILABLE'}
- Support: ${support ? `$${support.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}
- Resistance: ${resistance ? `$${resistance.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}
- 52-week High: ${high52w ? `$${high52w.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}
- 52-week Low: ${low52w ? `$${low52w.toFixed(2)}` : 'DATA_NOT_AVAILABLE'}

RULES: Interpret ONLY the above values. All string items must be plain text, no URLs, no markdown, max 15 words each.

Return JSON:
{"verdict":"Bullish"|"Neutral"|"Bearish","price_trend":["bullet1","bullet2"],"moving_averages":["bullet1","bullet2"],"rsi":["bullet1","bullet2"],"support_resistance":["bullet1","bullet2"],"technical_view":["bullet1","bullet2"]}`;
}

function buildVerdictPrompt(symbol: string, companyName: string): string {
  return `Synthesize an overall investment verdict for ${symbol} (${companyName}).

You MAY use web search for qualitative context (analyst consensus, recent news).
Do NOT fabricate specific analyst price targets or rating percentages.

All string items must be plain text, no URLs, no markdown, max 15 words each.
Return JSON:
{"overall":"Strongly Bullish"|"Moderately Bullish"|"Neutral"|"Moderately Bearish"|"Strongly Bearish","summary":["bullet1","bullet2","bullet3"],"key_drivers":["driver1","driver2","driver3"],"key_risks":["risk1","risk2","risk3"],"catalysts":["catalyst1","catalyst2","catalyst3"]}`;
}

// ─── Symbol validator ─────────────────────────────────────────────────────────

function validateSymbol(req: Request, res: Response): string | null {
  const symbol = (req.query.symbol as string | undefined)?.toUpperCase().trim() ?? '';
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' });
    return null;
  }
  return symbol;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/research/summary', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const cacheKey = `summary:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
    const [quote, profile] = await Promise.all([getQuote(symbol), getCompanyProfile(symbol)]);
    const result = {
      ticker: symbol,
      companyName: profile?.name ?? symbol,
      exchange: profile?.exchange ? profile.exchange.split(' ')[0] : '',
      industry: profile?.industry ?? '',
      marketCap: profile?.marketCap ?? null,
      price: quote.currentPrice ?? 0,
      change: quote.change ?? 0,
      changePercent: quote.changePercent ?? 0,
    };
    setCached(cacheKey, result);
    console.log(`[ai:summary] symbol=${symbol} latencyMs=${Date.now() - start}`);
    return res.json(result);
  } catch (err) {
    console.error(`[ai:summary] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch summary' });
  }
});

router.get('/research/foundation', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const cacheKey = `foundation:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
    const profile = await getCompanyProfile(symbol);
    const raw = await withTimeout(
      withRetry(() => callGPT({
        prompt: buildFoundationPrompt(symbol, profile?.name ?? symbol, profile?.industry ?? ''),
        useWebSearch: true, section: 'foundation', symbol,
      })),
      SECTION_TIMEOUT_MS,
    );
    const sanitized = sanitizeAIOutput('foundation', raw as Record<string, unknown>);
    const validation = validateAIOutput('foundation', sanitized.data);
    const confidence = buildQualitativeConfidence(validation);
    const adjustedScore = sanitized.confidence_degraded ? Math.max(0, confidence.score - 15) : confidence.score;
    const data = validateSection(FoundationSchema, sanitized.data, 'foundation');
    const result = withConfidence(data as unknown as Record<string, unknown>, adjustedScore, 'CURRENT', sanitized.validation_warnings);
    setCached(cacheKey, result);
    console.log(`[ai:foundation] symbol=${symbol} confidence=${adjustedScore} warnings=${sanitized.validation_warnings.length} total=${Date.now() - start}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[ai:foundation] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Foundation generation failed' });
  }
});

router.get('/research/valuation', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const cacheKey = `valuation:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
    const verified = await getVerifiedFinancials(symbol);

    const inputValidation = validateFinancialInputs({
      roeTTM: verified.roeTTM,
      grossMarginTTM: verified.grossMarginTTM,
      netProfitMarginTTM: verified.netProfitMarginTTM,
      revenueGrowthTTMYoy: verified.revenueGrowthTTMYoy,
      psTTM: verified.psTTM,
      peRatioTTM: verified.peRatioTTM,
    });

    const sanitizedMetrics = {
      peRatioTTM: inputValidation.sanitized.peRatioTTM ?? null,
      evEbitdaTTM: verified.evEbitdaTTM,
      roeTTM: inputValidation.sanitized.roeTTM ?? null,
      revenueGrowthTTMYoy: inputValidation.sanitized.revenueGrowthTTMYoy ?? null,
      grossMarginTTM: inputValidation.sanitized.grossMarginTTM ?? null,
      netProfitMarginTTM: inputValidation.sanitized.netProfitMarginTTM ?? null,
      debtEquityTTM: verified.debtEquityTTM,
      currentRatioTTM: verified.currentRatioTTM,
      freeCashFlowTTM: verified.freeCashFlowTTM,
      psTTM: inputValidation.sanitized.psTTM ?? null,
    };

    const raw = await withTimeout(
      withRetry(() => callGPT({
        prompt: buildValuationPrompt(symbol, verified.companyName, verified.price, verified.marketCapB, sanitizedMetrics),
        useWebSearch: false, section: 'valuation', symbol,
      })),
      SECTION_TIMEOUT_MS,
    );

    const sanitized = sanitizeAIOutput('valuation', raw as Record<string, unknown>);
    const allWarnings = [...inputValidation.warnings, ...sanitized.validation_warnings];

    const validation = validateAIOutput('valuation', sanitized.data);
    const confidence = buildDataDrivenConfidence(verified.dataCompleteness, validation);
    const adjustedScore = sanitized.confidence_degraded ? Math.max(0, confidence.score - 15) : confidence.score;

    const data = validateSection(ValuationSchema, sanitized.data, 'valuation');
    const result = withConfidence(data as unknown as Record<string, unknown>, adjustedScore, 'CURRENT', allWarnings);
    setCached(cacheKey, result);
    console.log(`[ai:valuation] symbol=${symbol} confidence=${adjustedScore} warnings=${allWarnings.length} total=${Date.now() - start}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[ai:valuation] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Valuation generation failed' });
  }
});

router.get('/research/risks', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const cacheKey = `risks:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
    const profile = await getCompanyProfile(symbol);
    const raw = await withTimeout(
      withRetry(() => callGPT({
        prompt: buildRiskPrompt(symbol, profile?.name ?? symbol, profile?.industry ?? ''),
        useWebSearch: true, section: 'risks', symbol,
      })),
      SECTION_TIMEOUT_MS,
    );
    const sanitized = sanitizeAIOutput('risks', raw as Record<string, unknown>);
    const validation = validateAIOutput('risks', sanitized.data);
    const confidence = buildQualitativeConfidence(validation);
    const adjustedScore = sanitized.confidence_degraded ? Math.max(0, confidence.score - 15) : confidence.score;
    const data = validateSection(RisksSchema, sanitized.data, 'risks');
    const result = withConfidence(data as unknown as Record<string, unknown>, adjustedScore, 'CURRENT', sanitized.validation_warnings);
    setCached(cacheKey, result);
    console.log(`[ai:risks] symbol=${symbol} confidence=${adjustedScore} warnings=${sanitized.validation_warnings.length} total=${Date.now() - start}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[ai:risks] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Risk generation failed' });
  }
});

router.get('/research/technicals', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const cacheKey = `technicals:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
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
        useWebSearch: false, section: 'technicals', symbol,
      })),
      SECTION_TIMEOUT_MS,
    );
    const sanitized = sanitizeAIOutput('technicals', raw as Record<string, unknown>);
    const dataCompleteness = [rsiResult, dmaResult?.ma50, dmaResult?.ma200, srResult?.support, week52?.high52w]
      .filter(v => v !== null && v !== undefined).length / 5;
    const validation = validateAIOutput('technicals', sanitized.data);
    const confidence = buildDataDrivenConfidence(dataCompleteness, validation);
    const adjustedScore = sanitized.confidence_degraded ? Math.max(0, confidence.score - 15) : confidence.score;
    const data = validateSection(TechnicalsSchema, sanitized.data, 'technicals');
    const result = withConfidence(data as unknown as Record<string, unknown>, adjustedScore, 'CURRENT', sanitized.validation_warnings);
    setCached(cacheKey, result);
    console.log(`[ai:technicals] symbol=${symbol} confidence=${adjustedScore} warnings=${sanitized.validation_warnings.length} total=${Date.now() - start}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[ai:technicals] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Technicals generation failed' });
  }
});

router.get('/research/verdict', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const cacheKey = `verdict:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
    const profile = await getCompanyProfile(symbol);
    const companyName = profile?.name ?? symbol;

    const foundationCached = getCached(`foundation:${symbol}`) as OrchestratorFoundation | null;
    const valuationCached = getCached(`valuation:${symbol}`) as OrchestratorValuation | null;
    const risksCached = getCached(`risks:${symbol}`) as OrchestratorRisks | null;
    const technicalsCached = getCached(`technicals:${symbol}`) as OrchestratorTechnicals | null;

    let prompt: string;
    if (foundationCached && valuationCached && risksCached && technicalsCached) {
      const coreNormalized: Record<string, NormalizedModuleOutput> = {
        research_foundation: normalizeFoundation(foundationCached),
        valuation_financials: normalizeValuation(valuationCached),
        risk_red_teaming: normalizeRisks(risksCached),
        technicals: normalizeTechnicals(technicalsCached),
      };
      prompt = buildVerdictFromModulesPrompt(symbol, companyName, coreNormalized);
    } else {
      prompt = buildVerdictPrompt(symbol, companyName);
    }

    const raw = await withTimeout(
      withRetry(() => callGPT({ prompt, useWebSearch: false, section: 'verdict', symbol })),
      SECTION_TIMEOUT_MS,
    );
    const data = validateSection(VerdictSchema, raw, 'verdict');
    setCached(cacheKey, data);
    console.log(`[ai:verdict] symbol=${symbol} total=${Date.now() - start}ms`);
    return res.json(data);
  } catch (err) {
    console.error(`[ai:verdict] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Verdict generation failed' });
  }
});

router.get('/research/stream', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const tier = (req.query.tier as string | undefined)?.toLowerCase();
  const validTier = tier === 'basic' || tier === 'decent' || tier === 'indepth' ? tier : 'basic';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (event: string, payload: unknown) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    await runResearchPipeline(symbol, send, validTier);
    generateMarkdownReport(symbol, validTier).catch(err => {
      console.error(`[ai:stream] Failed to generate markdown report: ${err instanceof Error ? err.message : err}`);
    });
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : 'Pipeline failed' });
  } finally {
    if (!closed) res.end();
  }
});

// ─── Generic section endpoint ─────────────────────────────────────────────────

router.get('/research/section/:sectionKey', async (req: Request, res: Response) => {
  const symbol = validateSymbol(req, res);
  if (!symbol) return;

  const sectionKey = req.params.sectionKey as SectionSSEKey;
  const cacheKey = `${sectionKey}:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const start = Date.now();
  try {
    let result: unknown;

    switch (sectionKey) {
      case 'peer_comparison': {
        const [profile, selfVerified] = await Promise.all([getCompanyProfile(symbol), getVerifiedFinancials(symbol)]);
        const peers = getCompetitors(symbol, profile?.industry ?? '');
        const peerMetrics = await getPeerMetricsData(peers);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildPeerComparisonFromData(symbol, profile?.name ?? symbol, peers, peerMetrics, selfVerified),
          useWebSearch: false, section: 'peer_comparison', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('peer_comparison', raw);
        const confidence = buildDataDrivenConfidence(selfVerified.dataCompleteness, validation);
        result = withConfidence(validateSection(PeerComparisonSchema, raw, 'peer_comparison') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'rule_of_40': {
        const verified = await getVerifiedFinancials(symbol);
        const revenueGrowthPct = verified.revenueGrowthTTMYoy !== null ? verified.revenueGrowthTTMYoy * 100 : null;
        const grossMarginPct = verified.grossMarginTTM !== null ? verified.grossMarginTTM * 100 : null;
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildRuleOf40FromData(symbol, verified.companyName, revenueGrowthPct, grossMarginPct),
          useWebSearch: false, section: 'rule_of_40', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('rule_of_40', raw);
        const confidence = buildDataDrivenConfidence(verified.dataCompleteness, validation);
        result = withConfidence(validateSection(RuleOf40Schema, raw, 'rule_of_40') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'forward_ps': {
        const [verified, estimates] = await Promise.all([getVerifiedFinancials(symbol), getRevenueEstimatesData(symbol)]);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildForwardPSFromData(symbol, verified, estimates),
          useWebSearch: false, section: 'forward_ps', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('forward_ps', raw);
        const confidence = buildDataDrivenConfidence(estimates.available ? 0.9 : 0.4, validation);
        result = withConfidence(validateSection(ForwardPSSchema, raw, 'forward_ps') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'customer_concentration': {
        const profile = await getCompanyProfile(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildCustomerConcentrationFromData(symbol, profile?.name ?? symbol, profile?.industry ?? ''),
          useWebSearch: true, section: 'customer_concentration', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('customer_concentration', raw);
        const confidence = buildQualitativeConfidence(validation);
        result = withConfidence(validateSection(CustomerConcentrationSchema, raw, 'customer_concentration') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'short_seller_perspective': {
        const profile = await getCompanyProfile(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildShortSellerPerspectiveFromData(symbol, profile?.name ?? symbol),
          useWebSearch: true, section: 'short_seller_perspective', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('short_seller_perspective', raw);
        const confidence = buildQualitativeConfidence(validation);
        result = withConfidence(validateSection(ShortSellerPerspectiveSchema, raw, 'short_seller_perspective') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'historical_ps': {
        const verified = await getVerifiedFinancials(symbol);
        const psValid = verified.psTTM !== null && verified.psTTM > 0;
        if (!psValid) {
          console.warn(`[ai:historical_ps] symbol=${symbol} invalid P/S=${verified.psTTM} — returning unavailable`);
        }
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildHistoricalPSFromData(symbol, verified.companyName, psValid ? verified.psTTM : null),
          useWebSearch: true, section: 'historical_ps', symbol,
        })), SECTION_TIMEOUT_MS);
        const sanitized = sanitizeAIOutput('historical_ps', raw as Record<string, unknown>);
        const validation = validateAIOutput('historical_ps', sanitized.data);
        const confidence = buildQualitativeConfidence(validation);
        const adjustedScore = sanitized.confidence_degraded ? Math.max(0, confidence.score - 15) : confidence.score;
        result = withConfidence(
          validateSection(HistoricalPSSchema, sanitized.data, 'historical_ps') as unknown as Record<string, unknown>,
          adjustedScore,
          'CURRENT',
          sanitized.validation_warnings
        );
        break;
      }
      case 'insider_ownership': {
        const insiderData = await getInsiderOwnershipData(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildInsiderOwnershipFromData(symbol, insiderData.totalInsiderPct, insiderData.insiderCount),
          useWebSearch: false, section: 'insider_ownership', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('insider_ownership', raw);
        const confidence = buildDataDrivenConfidence(insiderData.available ? 0.85 : 0.0, validation);
        result = withConfidence(validateSection(InsiderOwnershipSchema, raw, 'insider_ownership') as unknown as Record<string, unknown>, confidence.score, insiderData.available ? 'CURRENT' : 'UNAVAILABLE');
        break;
      }
      case 'asymmetry_analysis': {
        const verified = await getVerifiedFinancials(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildAsymmetryFromData(symbol, verified),
          useWebSearch: false, section: 'asymmetry_analysis', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('asymmetry_analysis', raw);
        const confidence = buildDataDrivenConfidence(verified.dataCompleteness, validation);
        result = withConfidence(validateSection(AsymmetryAnalysisSchema, raw, 'asymmetry_analysis') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'relative_strength': {
        const rs = await getRelativeStrengthData(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildRelativeStrengthFromData(symbol, rs),
          useWebSearch: false, section: 'relative_strength', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('relative_strength', raw);
        const confidence = buildDataDrivenConfidence(rs.available ? 1.0 : 0.0, validation);
        result = withConfidence(validateSection(RelativeStrengthSchema, raw, 'relative_strength') as unknown as Record<string, unknown>, confidence.score, rs.available ? 'CURRENT' : 'UNAVAILABLE');
        break;
      }
      case 'short_interest': {
        const si = await getShortInterestData(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildShortInterestFromData(symbol, si),
          useWebSearch: false, section: 'short_interest', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('short_interest', raw);
        const confidence = buildDataDrivenConfidence(si.available ? 0.8 : 0.0, validation);
        result = withConfidence(validateSection(ShortInterestSchema, raw, 'short_interest') as unknown as Record<string, unknown>, confidence.score, si.available ? 'CURRENT' : 'UNAVAILABLE');
        break;
      }
      case 'retail_sentiment': {
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildRetailSentimentFromData(symbol),
          useWebSearch: true, section: 'retail_sentiment', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('retail_sentiment', raw);
        const confidence = buildQualitativeConfidence(validation);
        result = withConfidence(validateSection(RetailSentimentSchema, raw, 'retail_sentiment') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'volume_patterns': {
        const vol = await getVolumePatternData(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildVolumePatternsFromData(symbol, vol),
          useWebSearch: false, section: 'volume_patterns', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('volume_patterns', raw);
        const confidence = buildDataDrivenConfidence(vol.available ? 0.9 : 0.0, validation);
        result = withConfidence(validateSection(VolumePatternsSchema, raw, 'volume_patterns') as unknown as Record<string, unknown>, confidence.score, vol.available ? 'CURRENT' : 'UNAVAILABLE');
        break;
      }
      case 'bull_case_critique': {
        const profile = await getCompanyProfile(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildBullCaseCritiqueFromData(symbol, profile?.name ?? symbol),
          useWebSearch: true, section: 'bull_case_critique', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('bull_case_critique', raw);
        const confidence = buildQualitativeConfidence(validation);
        result = withConfidence(validateSection(BullCaseCritiqueSchema, raw, 'bull_case_critique') as unknown as Record<string, unknown>, confidence.score);
        break;
      }
      case 'earnings_miss': {
        const earnings = await getEarningsSurprisesData(symbol);
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildEarningsMissFromData(symbol, earnings),
          useWebSearch: false, section: 'earnings_miss', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('earnings_miss', raw);
        const confidence = buildDataDrivenConfidence(earnings.available ? 0.9 : 0.0, validation);
        result = withConfidence(validateSection(EarningsMissSchema, raw, 'earnings_miss') as unknown as Record<string, unknown>, confidence.score, earnings.available ? 'CURRENT' : 'UNAVAILABLE');
        break;
      }
      case 'implied_volatility': {
        const week52 = await getWeek52Data(symbol);
        const hv30 = week52?.closes ? computeHistoricalVolatility(week52.closes, 30) : null;
        const raw = await withTimeout(withRetry(() => callGPT({
          prompt: buildImpliedVolatilityFromData(symbol, hv30),
          useWebSearch: false, section: 'implied_volatility', symbol,
        })), SECTION_TIMEOUT_MS);
        const validation = validateAIOutput('implied_volatility', raw);
        const confidence = buildDataDrivenConfidence(hv30 !== null ? 0.7 : 0.0, validation);
        result = withConfidence(validateSection(ImpliedVolatilitySchema, raw, 'implied_volatility') as unknown as Record<string, unknown>, confidence.score, hv30 !== null ? 'CURRENT' : 'UNAVAILABLE');
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown section: ${sectionKey}` });
    }

    setCached(cacheKey, result);
    console.log(`[ai:${sectionKey}] symbol=${symbol} total=${Date.now() - start}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[ai:${sectionKey}] symbol=${symbol} error=${err instanceof Error ? err.message : err}`);
    return res.status(500).json({ error: err instanceof Error ? err.message : `${sectionKey} generation failed` });
  }
});

export default router;

// ─── Inline prompt builder helpers for /section/:key route ───────────────────
// These mirror the orchestrator's prompt builders to keep the route handler thin.

import type { VerifiedFinancials, VerifiedShortInterest, VerifiedRevenueEstimates, VerifiedRelativeStrength, VerifiedVolumeData, VerifiedEarnings } from '../services/market-data.service';

function buildPeerComparisonFromData(
  symbol: string, companyName: string, peers: string[],
  peerMetrics: Map<string, { psTTM: number | null; evEbitdaTTM: number | null; grossMarginTTM: number | null; revenueGrowthTTMYoy: number | null; marketCapB: number | null }>,
  self: VerifiedFinancials,
): string {
  const fmt = (v: number | null) => v !== null ? String(Math.round(v * 10) / 10) : 'DATA_NOT_AVAILABLE';
  const fmtPct = (v: number | null) => normalizePercent(v).display;
  const rows = [{ symbol, psTTM: self.psTTM, evEbitdaTTM: self.evEbitdaTTM, grossMarginTTM: self.grossMarginTTM, revenueGrowthTTMYoy: self.revenueGrowthTTMYoy, marketCapB: self.marketCapB },
    ...peers.map(p => ({ symbol: p, ...peerMetrics.get(p) ?? { psTTM: null, evEbitdaTTM: null, grossMarginTTM: null, revenueGrowthTTMYoy: null, marketCapB: null } }))];
  const table = rows.map(r => `${r.symbol}: P/S=${fmt(r.psTTM)}, EV/EBITDA=${fmt(r.evEbitdaTTM)}, GrossMargin=${fmtPct(r.grossMarginTTM)}, RevGrowth=${fmtPct(r.revenueGrowthTTMYoy)}`).join('\n');
  return `Interpret relative valuation for ${symbol} (${companyName}) vs peers.\n\nUsing ONLY the VERIFIED PEER METRICS below [source: Finnhub API]:\n${table}\n\nPeers: ${peers.join(', ')}\nRULES: Use ONLY above values. All string items max 15 words.\nReturn JSON: {"verdict":"Attractive"|"Fair"|"Expensive","comparison_table":[${rows.map(r => `{"symbol":"${r.symbol}","ps_ttm":"${fmt(r.psTTM)}","ps_forward":"DATA_NOT_AVAILABLE","ev_ebitda":"${fmt(r.evEbitdaTTM)}","gross_margin":"${fmtPct(r.grossMarginTTM)}","revenue_growth":"${fmtPct(r.revenueGrowthTTMYoy)}","value_growth_score":"DATA_NOT_AVAILABLE"}`).join(',')}],"insights":["insight1","insight2","insight3"]}`;
}

function buildRuleOf40FromData(symbol: string, companyName: string, revenueGrowthPct: number | null, grossMarginPct: number | null): string {
  const rg = revenueGrowthPct !== null ? `${revenueGrowthPct.toFixed(2)}%` : 'DATA_NOT_AVAILABLE';
  const gm = grossMarginPct !== null ? `${grossMarginPct.toFixed(2)}%` : 'DATA_NOT_AVAILABLE';
  const score = revenueGrowthPct !== null && grossMarginPct !== null ? String(Math.round(revenueGrowthPct + grossMarginPct)) : 'DATA_NOT_AVAILABLE';
  return `Interpret Rule of 40 for ${symbol} (${companyName}).\n\nVERIFIED DATA [Finnhub TTM]: Revenue Growth=${rg}, Gross Margin (proxy for EBITDA margin)=${gm}, Computed Score=${score}\n\nRULES: Use ONLY above values. Quarterly breakdown is DATA_NOT_AVAILABLE. All strings max 15 words.\nReturn JSON: {"verdict":"Strong"|"Moderate"|"Weak","current_score":"${score}","trend":"Improving"|"Stable"|"Declining","quarterly_data":[{"quarter":"TTM","revenue_growth":"${rg}","ebitda_margin":"${gm}","score":"${score}"}],"insights":["insight1","insight2","insight3"]}`;
}

function buildForwardPSFromData(symbol: string, v: VerifiedFinancials, e: VerifiedRevenueEstimates): string {
  const mktCap = v.marketCapB !== null ? `$${v.marketCapB}B` : 'DATA_NOT_AVAILABLE';
  const nextRev = e.nextYearRevenue !== null ? `$${Math.round(e.nextYearRevenue)}M` : 'DATA_NOT_AVAILABLE';
  const currentPS = v.psTTM !== null ? String(Math.round(v.psTTM * 10) / 10) : 'DATA_NOT_AVAILABLE';
  const forwardPS = v.marketCapB !== null && e.nextYearRevenue !== null && e.nextYearRevenue > 0
    ? String(Math.round(((v.marketCapB * 1000) / e.nextYearRevenue) * 10) / 10) : 'DATA_NOT_AVAILABLE';
  const s10 = v.marketCapB !== null && e.nextYearRevenue !== null && e.nextYearRevenue > 0
    ? String(Math.round(((v.marketCapB * 1000) / (e.nextYearRevenue * 0.9)) * 10) / 10) : 'DATA_NOT_AVAILABLE';
  const s20 = v.marketCapB !== null && e.nextYearRevenue !== null && e.nextYearRevenue > 0
    ? String(Math.round(((v.marketCapB * 1000) / (e.nextYearRevenue * 0.8)) * 10) / 10) : 'DATA_NOT_AVAILABLE';
  return `Interpret forward valuation for ${symbol}.\n\nVERIFIED DATA [Finnhub]: Price=$${v.price}, MarketCap=${mktCap}, TTM P/S=${currentPS}, Next-Year Revenue Est=${nextRev} [${e.analystCount ?? 'N/A'} analysts], Forward P/S=${forwardPS}\n\nRULES: Use ONLY above values. All strings max 15 words.\nReturn JSON: {"verdict":"Attractive"|"Fair"|"Stretched","ttm_ps":"${currentPS}","forward_ps":"${forwardPS}","guidance":"${nextRev} for ${e.fiscalYearEnd ?? 'forward FY'}","stress_test":["If -10%: P/S = ${s10}","If -20%: P/S = ${s20}"],"insights":["insight1","insight2","insight3"]}`;
}

function buildCustomerConcentrationFromData(symbol: string, companyName: string, industry: string): string {
  return `Analyze customer concentration for ${symbol} (${companyName}, industry: ${industry}).\n\nCRITICAL RULES:\n- ONLY include data from SEC filings (10-K, 10-Q), official press releases, or company IR pages\n- Do NOT state customer relationships as facts unless explicitly documented\n- Do NOT estimate percentages — if not disclosed, use "DATA_NOT_AVAILABLE"\n- Replace specific company names with hedged descriptions like "large cloud infrastructure customer" unless officially disclosed\n- All strings max 15 words\n\nReturn JSON: {"verdict":"Low Risk"|"Moderate Risk"|"High Risk","concentration_pct":"DATA_NOT_AVAILABLE","top_customers":[{"rank":"#1","revenue_pct":"DATA_NOT_AVAILABLE","trend":"Rising"|"Stable"|"Falling"}],"insights":["insight1","insight2","insight3"]}`;
}

function buildShortSellerPerspectiveFromData(symbol: string, companyName: string): string {
  return `Short seller thesis for ${symbol} (${companyName}). Search published bear reports.\nDo NOT fabricate allegations. Do NOT invent specific numbers. All strings max 15 words.\nReturn JSON: {"verdict":"Weak Short Case"|"Moderate Short Case"|"Strong Short Case","bear_thesis":["thesis1","thesis2","thesis3"],"short_catalysts":["catalyst1","catalyst2"],"counter_arguments":["counter1","counter2"]}`;
}

function buildHistoricalPSFromData(symbol: string, companyName: string, psTTM: number | null): string {
  const psValid = psTTM !== null && psTTM > 0;
  const ps = psValid ? psTTM.toFixed(2) : 'DATA_NOT_AVAILABLE';
  
  // Force DATA_NOT_AVAILABLE verdict when current P/S is unavailable
  if (!psValid) {
    return `Interpret historical P/S context for ${symbol} (${companyName}).\n\nVERIFIED: Current P/S=DATA_NOT_AVAILABLE [Finnhub]\n\nCRITICAL: Current P/S data is unavailable. You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer "Mid-Range" or any other verdict.\n\nReturn JSON: {"verdict":"DATA_NOT_AVAILABLE","current_ps":"DATA_NOT_AVAILABLE","min_3y":"DATA_NOT_AVAILABLE","max_3y":"DATA_NOT_AVAILABLE","avg_3y":"DATA_NOT_AVAILABLE","percentile":"DATA_NOT_AVAILABLE","insights":["Historical P/S analysis requires current P/S data which is unavailable"]}`;
  }
  
  return `Interpret historical P/S context for ${symbol} (${companyName}).\n\nVERIFIED: Current P/S=${ps} [Finnhub]\n\nCRITICAL RULES:\n- Do NOT estimate or invent historical P/S ranges\n- Only use verifiable data from credible financial sources\n- If historical data is not found via search, use DATA_NOT_AVAILABLE\n- Zero or negative P/S values are invalid — use DATA_NOT_AVAILABLE\n- If historical min/max/avg are all DATA_NOT_AVAILABLE, verdict MUST be "DATA_NOT_AVAILABLE"\n- All strings max 15 words\n\nReturn JSON: {"verdict":"At Historical Low"|"Mid-Range"|"At Historical High"|"DATA_NOT_AVAILABLE","current_ps":"${ps}","min_3y":"DATA_NOT_AVAILABLE","max_3y":"DATA_NOT_AVAILABLE","avg_3y":"DATA_NOT_AVAILABLE","percentile":"DATA_NOT_AVAILABLE","insights":["insight1","insight2","insight3"]}`;
}

function buildInsiderOwnershipFromData(symbol: string, insiderPct: number | null, insiderCount: number | null): string {
  const pct = insiderPct !== null ? `${insiderPct.toFixed(2)}%` : 'DATA_NOT_AVAILABLE';
  
  // Force DATA_NOT_AVAILABLE verdict when insider ownership % is unavailable
  if (insiderPct === null) {
    return `Interpret insider alignment for ${symbol}.\n\nVERIFIED [Finnhub]: Insider Ownership=DATA_NOT_AVAILABLE, Positions Tracked=${insiderCount ?? 'DATA_NOT_AVAILABLE'}\n\nCRITICAL: Insider ownership percentage is unavailable. You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer "Moderate Alignment" or "Weak Alignment".\n\nReturn JSON: {"verdict":"DATA_NOT_AVAILABLE","insider_ownership_pct":"DATA_NOT_AVAILABLE","industry_avg":"DATA_NOT_AVAILABLE","sbc_pct_revenue":"DATA_NOT_AVAILABLE","insights":["Insider ownership analysis requires ownership percentage data which is unavailable"]}`;
  }
  
  return `Interpret insider alignment for ${symbol}.\n\nVERIFIED [Finnhub]: Insider Ownership=${pct}, Positions Tracked=${insiderCount ?? 'DATA_NOT_AVAILABLE'}\n\nRULES: Use ONLY verified data. Industry avg and SBC are DATA_NOT_AVAILABLE. All strings max 15 words.\nReturn JSON: {"verdict":"Strong Alignment"|"Moderate Alignment"|"Weak Alignment","insider_ownership_pct":"${pct}","industry_avg":"DATA_NOT_AVAILABLE","sbc_pct_revenue":"DATA_NOT_AVAILABLE","insights":["insight1","insight2","insight3"]}`;
}

function buildAsymmetryFromData(symbol: string, v: VerifiedFinancials): string {
  const fmt = (x: number | null, s = '') => x !== null ? `${Math.round(x * 100) / 100}${s}` : 'DATA_NOT_AVAILABLE';
  const fmtPct = (x: number | null) => normalizePercent(x).display;

  const valuation = computeDeterministicValuationBands(v);

  return `Analyze risk/reward asymmetry for ${symbol} (${v.companyName}).\n\nVERIFIED [Finnhub]: Price=$${v.price}, MarketCap=${v.marketCapB !== null ? `$${v.marketCapB}B` : 'DATA_NOT_AVAILABLE'}, P/E=${fmt(v.peRatioTTM)}, P/S=${fmt(v.psTTM)}, RevGrowth=${fmtPct(v.revenueGrowthTTMYoy)}, GrossMargin=${fmtPct(v.grossMarginTTM)}\n\nPRE-COMPUTED VALUATION BANDS [deterministic]:\n- Downside Floor: ${valuation.downsideFloor}\n- Upside Ceiling: ${valuation.upsideCeiling}\n- Risk/Reward Ratio: ${valuation.riskRewardRatio}\n\nRULES: Use ONLY the pre-computed valuation bands above. Do NOT invent or modify price targets. All strings max 15 words.\nReturn JSON: {"verdict":"Highly Asymmetric"|"Balanced"|"Unfavorable","downside_floor":"${valuation.downsideFloor}","upside_ceiling":"${valuation.upsideCeiling}","risk_reward_ratio":"${valuation.riskRewardRatio}","base_case":["assumption1","assumption2"],"bull_case":["driver1","driver2"],"bear_case":["risk1","risk2"]}`;
}

interface ValuationBands {
  downsideFloor: string;
  upsideCeiling: string;
  riskRewardRatio: string;
}

function computeDeterministicValuationBands(v: VerifiedFinancials): ValuationBands {
  const unavailable: ValuationBands = {
    downsideFloor: 'DATA_NOT_AVAILABLE',
    upsideCeiling: 'DATA_NOT_AVAILABLE',
    riskRewardRatio: 'DATA_NOT_AVAILABLE',
  };

  if (v.price <= 0 || v.psTTM === null || v.psTTM <= 0) {
    return unavailable;
  }

  const currentPS = v.psTTM;
  const bearPS = Math.max(currentPS * 0.5, 1);
  const bullPS = currentPS * 1.5;

  const impliedRevenue = v.marketCapB !== null && currentPS > 0
    ? (v.marketCapB * 1000) / currentPS
    : null;

  if (impliedRevenue === null || impliedRevenue <= 0) {
    return unavailable;
  }

  const bearPrice = (bearPS * impliedRevenue) / (v.marketCapB! * 1000 / v.price);
  const bullPrice = (bullPS * impliedRevenue) / (v.marketCapB! * 1000 / v.price);

  const downsidePct = ((bearPrice - v.price) / v.price) * 100;
  const upsidePct = ((bullPrice - v.price) / v.price) * 100;

  if (!isFinite(bearPrice) || !isFinite(bullPrice) || !isFinite(downsidePct) || !isFinite(upsidePct)) {
    return unavailable;
  }

  const downside = Math.abs(v.price - bearPrice);
  const upside = Math.abs(bullPrice - v.price);
  const ratio = downside > 0 ? (upside / downside).toFixed(1) : 'DATA_NOT_AVAILABLE';

  return {
    downsideFloor: `$${bearPrice.toFixed(2)} (${downsidePct.toFixed(1)}%)`,
    upsideCeiling: `$${bullPrice.toFixed(2)} (+${upsidePct.toFixed(1)}%)`,
    riskRewardRatio: typeof ratio === 'string' && ratio !== 'DATA_NOT_AVAILABLE' ? `${ratio}:1` : 'DATA_NOT_AVAILABLE',
  };
}

function buildRelativeStrengthFromData(symbol: string, rs: VerifiedRelativeStrength): string {
  const fmt = (v: number | null, s = '') => v !== null ? `${v.toFixed(2)}${s}` : 'DATA_NOT_AVAILABLE';
  return `Interpret relative strength for ${symbol}.\n\nVERIFIED [computed]: ${symbol} 3M return=${fmt(rs.return3m, '%')}, SPY 3M return=${fmt(rs.spyReturn3m, '%')}, vs SPY=${fmt(rs.rsVsSPY, '%')}\n\nRULES: Use ONLY above values. All strings max 15 words.\nReturn JSON: {"verdict":"Outperforming"|"In-Line"|"Underperforming","rs_3m_trend":"Accelerating"|"Stable"|"Declining","breakout_breakdown":"${rs.rsVsSPY !== null ? (rs.rsVsSPY > 0 ? `Outperforming SPY by ${Math.round(Math.abs(rs.rsVsSPY) * 10) / 10}%` : `Underperforming SPY by ${Math.round(Math.abs(rs.rsVsSPY) * 10) / 10}%`) : 'DATA_NOT_AVAILABLE'}","insights":["insight1","insight2","insight3"]}`;
}

function buildShortInterestFromData(symbol: string, si: VerifiedShortInterest): string {
  const pct = si.shortInterestPct !== null ? `${si.shortInterestPct.toFixed(2)}%` : 'DATA_NOT_AVAILABLE';
  const dtc = si.daysToCover !== null ? `${si.daysToCover.toFixed(1)} days` : 'DATA_NOT_AVAILABLE';
  
  // Force DATA_NOT_AVAILABLE verdict when both key metrics are unavailable
  if (si.shortInterestPct === null && si.daysToCover === null) {
    return `Interpret short interest for ${symbol}.\n\nVERIFIED [Finnhub]: Short Interest=DATA_NOT_AVAILABLE, Days to Cover=DATA_NOT_AVAILABLE, Report Date=${si.reportDate ?? 'DATA_NOT_AVAILABLE'}\n\nCRITICAL: Short interest data is unavailable. You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer "Moderate" or "Low".\n\nReturn JSON: {"verdict":"DATA_NOT_AVAILABLE","short_interest_pct":"DATA_NOT_AVAILABLE","days_to_cover":"DATA_NOT_AVAILABLE","trend_12m":"DATA_NOT_AVAILABLE","squeeze_potential":"DATA_NOT_AVAILABLE","insights":["Short interest analysis requires actual short interest data which is unavailable"]}`;
  }
  
  return `Interpret short interest for ${symbol}.\n\nVERIFIED [Finnhub]: Short Interest=${pct}, Days to Cover=${dtc}, Report Date=${si.reportDate ?? 'DATA_NOT_AVAILABLE'}\n\nRULES: Use ONLY above values. trend_12m=DATA_NOT_AVAILABLE. All strings max 15 words.\nReturn JSON: {"verdict":"High Squeeze Potential"|"Moderate"|"Low","short_interest_pct":"${pct}","days_to_cover":"${dtc}","trend_12m":"DATA_NOT_AVAILABLE","squeeze_potential":"${si.shortInterestPct !== null && si.shortInterestPct > 15 ? 'High if catalyst present' : 'Low to Moderate'}","insights":["insight1","insight2","insight3"]}`;
}

function buildRetailSentimentFromData(symbol: string): string {
  return `Search recent retail sentiment for ${symbol} (last 7 days).\n\nYou MAY use web search for qualitative Stocktwits/Reddit mood. Do NOT invent sentiment scores. All strings max 15 words.\nReturn JSON: {"verdict":"Bullish"|"Neutral"|"Bearish","sentiment_score":"DATA_NOT_AVAILABLE","stocktwits_sentiment":"Bullish"|"Neutral"|"Bearish","reddit_sentiment":"Bullish"|"Neutral"|"Bearish","insights":["insight1","insight2","insight3"]}`;
}

function buildVolumePatternsFromData(symbol: string, v: VerifiedVolumeData): string {
  const avg = v.avgVolume30d !== null ? v.avgVolume30d.toLocaleString() : 'DATA_NOT_AVAILABLE';
  const cur = v.currentVolume !== null ? v.currentVolume.toLocaleString() : 'DATA_NOT_AVAILABLE';
  const ratio = v.volumeRatio !== null ? `${Math.round(v.volumeRatio * 100) / 100}x average` : 'DATA_NOT_AVAILABLE';
  
  // Force DATA_NOT_AVAILABLE verdict when volume data is insufficient
  if (v.avgVolume30d === null && v.currentVolume === null) {
    return `Interpret volume patterns for ${symbol}.\n\nVERIFIED [computed]: 30d Avg Volume=DATA_NOT_AVAILABLE, Today's Volume=DATA_NOT_AVAILABLE, Volume Ratio=DATA_NOT_AVAILABLE\n\nCRITICAL: Volume data is unavailable. You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer patterns or trends.\n\nReturn JSON: {"verdict":"DATA_NOT_AVAILABLE","recent_patterns":["Insufficient volume data to analyze patterns"],"breakout_breakdown":"Insufficient volume data","insights":["Volume analysis requires historical data which is currently unavailable"]}`;
  }
  
  // If volume ratio is unavailable, don't infer "No volume spike"
  if (v.volumeRatio === null) {
    return `Interpret volume patterns for ${symbol}.\n\nVERIFIED [computed]: 30d Avg Volume=${avg}, Today's Volume=${cur}, Volume Ratio=DATA_NOT_AVAILABLE, High Volume Days (last 30d)=${v.highVolumeDays}\n\nCRITICAL: Volume ratio is unavailable. You MUST return verdict="DATA_NOT_AVAILABLE". Do NOT infer "No volume spike" or patterns.\n\nReturn JSON: {"verdict":"DATA_NOT_AVAILABLE","recent_patterns":["Insufficient volume data to analyze patterns"],"breakout_breakdown":"Insufficient volume data","insights":["Volume pattern analysis requires volume ratio data which is unavailable"]}`;
  }
  
  const breakoutText = v.volumeRatio > 2 ? `High volume day: ${Math.round(v.volumeRatio * 10) / 10}x avg` : 'No significant volume spike today';
  
  return `Interpret volume patterns for ${symbol}.\n\nVERIFIED [computed]: 30d Avg Volume=${avg}, Today's Volume=${cur}, Volume Ratio=${ratio}, High Volume Days (last 30d)=${v.highVolumeDays}\n\nRULES: Use ONLY above values. All strings max 15 words.\nReturn JSON: {"verdict":"Bullish Pattern"|"Neutral"|"Bearish Pattern","recent_patterns":["pattern1","pattern2"],"breakout_breakdown":"${breakoutText}","insights":["insight1","insight2","insight3"]}`;
}

function buildBullCaseCritiqueFromData(symbol: string, companyName: string): string {
  return `Critique the bull case for ${symbol} (${companyName}). Search published skeptical analysis.\nDo NOT fabricate specific allegations. All strings max 15 words.\nReturn JSON: {"verdict":"Bull Case Holds"|"Bull Case Questionable"|"Bull Case Weak","bull_thesis":["thesis1","thesis2"],"critique_points":["critique1","critique2","critique3"],"market_discount_reason":["reason1","reason2"]}`;
}

function buildEarningsMissFromData(symbol: string, e: VerifiedEarnings): string {
  const recent = e.surprises.slice(0, 4).map(s => `${s.quarter}: ${s.surprisePct !== null ? `${Math.round(s.surprisePct * 100) / 100}%` : 'N/A'}`).join(', ') || 'DATA_NOT_AVAILABLE';
  const lastMiss = e.surprises.find(s => s.surprisePct !== null && s.surprisePct < -2);
  return `Interpret earnings track record for ${symbol}.\n\nVERIFIED [Finnhub]: Recent surprises: ${recent}, Misses in ${e.surprises.length} quarters: ${e.recentMisses}\n\nRULES: Use ONLY above data. stock_reaction=DATA_NOT_AVAILABLE. All strings max 15 words.\nReturn JSON: {"verdict":"Clean Track"|"Recent Miss"|"Multiple Misses","last_miss_date":"${lastMiss ? lastMiss.quarter : 'No recent miss'}","miss_reason":"DATA_NOT_AVAILABLE","stock_reaction":"DATA_NOT_AVAILABLE","insights":["insight1","insight2"]}`;
}

function buildImpliedVolatilityFromData(symbol: string, hv30: number | null): string {
  const hv = hv30 !== null ? `${hv30.toFixed(2)}%` : 'DATA_NOT_AVAILABLE';
  let verdict = 'Normal IV';
  if (hv30 !== null) { if (hv30 > 60) verdict = 'High IV'; else if (hv30 < 20) verdict = 'Low IV'; }
  return `Interpret volatility for ${symbol}.\n\nVERIFIED [computed from price data]: Historical Volatility (30-day annualised)=${hv}\nImplied Volatility: DATA_NOT_AVAILABLE [requires options API]\n\nRULES: Set current_iv=DATA_NOT_AVAILABLE, historical_iv=${hv}, iv_percentile=DATA_NOT_AVAILABLE. All strings max 15 words.\nReturn JSON: {"verdict":"${verdict}","current_iv":"DATA_NOT_AVAILABLE","historical_iv":"${hv}","iv_percentile":"DATA_NOT_AVAILABLE","insights":["insight1","insight2","insight3"]}`;
}
