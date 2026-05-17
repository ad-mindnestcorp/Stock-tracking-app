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
import { AI_CONFIG } from '../config/ai.config';
import {
  FoundationSchema,
  ValuationSchema,
  RisksSchema,
  TechnicalsSchema,
  VerdictSchema,
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
}

async function callGPT({ prompt, useWebSearch, section, symbol }: OpenAICallOptions): Promise<unknown> {
  const client = getOpenAI();
  const start = Date.now();
  let text: string;
  let promptTokens: number | string = '?';
  let completionTokens: number | string = '?';

  if (useWebSearch) {
    // Responses API — supports web_search_preview for real-time data
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
    promptTokens = response.usage?.input_tokens ?? '?';
    completionTokens = response.usage?.output_tokens ?? '?';
    console.log(`[ai:${section}] symbol=${symbol} model=${model} webSearch=true promptTokens=${promptTokens} completionTokens=${completionTokens} latencyMs=${Date.now() - start} outputTextLen=${text.length}`);
  } else {
    // Chat completions — faster and cheaper for data-driven sections
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
    const choice = response.choices[0];
    text = choice?.message?.content ?? '{}';
    promptTokens = response.usage?.prompt_tokens ?? '?';
    completionTokens = response.usage?.completion_tokens ?? '?';
    console.log(`[ai:${section}] symbol=${symbol} model=${model} webSearch=false promptTokens=${promptTokens} completionTokens=${completionTokens} finishReason=${choice?.finish_reason} latencyMs=${Date.now() - start} textLen=${text.length}`);
  }

  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    return JSON.parse(stripped);
  } catch {
    // Last resort: extract first {...} block from the raw text
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    console.error(`[ai:${section}] symbol=${symbol} FULL raw response:\n---\n${text}\n---`);
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
For the metrics array, look up real current values via web search if the provided value is null/N/A.
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
  symbol: string,
  price: number,
  rsi: number | null,
  rsiTrend: string | null,
  ma50: number | null,
  ma200: number | null,
  support: number | null,
  resistance: number | null,
  high52w: number | null,
  low52w: number | null
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

function buildVerdictPrompt(symbol: string, companyName: string): string {
  return `Synthesize an overall investment verdict for ${symbol} (${companyName}). Include analyst consensus, price targets, and overall thesis. Use web search for latest data.
All array string items must be plain text, no URLs, no markdown, max 15 words each.
Return JSON with exactly these fields:
{"overall":"Strongly Bullish"|"Moderately Bullish"|"Neutral"|"Moderately Bearish"|"Strongly Bearish","summary":["bullet1","bullet2","bullet3"],"key_drivers":["driver1","driver2","driver3"],"key_risks":["risk1","risk2","risk3"],"catalysts":["catalyst1","catalyst2","catalyst3"]}`;
}

// ─── Validation helper ────────────────────────────────────────────────────────

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
    const [quote, profile] = await Promise.all([
      getQuote(symbol),
      getCompanyProfile(symbol),
    ]);

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
    const companyName = profile?.name ?? symbol;
    const industry = profile?.industry ?? '';

    const raw = await withTimeout(
      withRetry(() => callGPT({ prompt: buildFoundationPrompt(symbol, companyName, industry), useWebSearch: true, section: 'foundation', symbol })),
      SECTION_TIMEOUT_MS
    );
    const data = validateSection(FoundationSchema, raw, 'foundation');

    setCached(cacheKey, data);
    console.log(`[ai:foundation] symbol=${symbol} total=${Date.now() - start}ms`);
    return res.json(data);
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
    const [quote, profile, financials] = await Promise.all([
      getQuote(symbol),
      getCompanyProfile(symbol),
      getBasicFinancials(symbol),
    ]);

    const companyName = profile?.name ?? symbol;
    const price = quote.currentPrice ?? 0;
    const marketCap = profile?.marketCap ?? null;
    const metrics = financials ?? {};

    const raw = await withTimeout(
      withRetry(() => callGPT({ prompt: buildValuationPrompt(symbol, companyName, price, marketCap, metrics as Record<string, unknown>), useWebSearch: true, section: 'valuation', symbol })),
      SECTION_TIMEOUT_MS
    );
    const data = validateSection(ValuationSchema, raw, 'valuation');

    setCached(cacheKey, data);
    console.log(`[ai:valuation] symbol=${symbol} total=${Date.now() - start}ms`);
    return res.json(data);
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
    const companyName = profile?.name ?? symbol;

    const raw = await withTimeout(
      withRetry(() => callGPT({ prompt: buildRiskPrompt(symbol, companyName), useWebSearch: true, section: 'risks', symbol })),
      SECTION_TIMEOUT_MS
    );
    const data = validateSection(RisksSchema, raw, 'risks');

    setCached(cacheKey, data);
    console.log(`[ai:risks] symbol=${symbol} total=${Date.now() - start}ms`);
    return res.json(data);
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
    const [quote, week52] = await Promise.all([
      getQuote(symbol),
      getWeek52Data(symbol),
    ]);

    const price = quote.currentPrice ?? 0;

    const rsiResult = week52?.closes ? calculateRSI(week52.closes) : null;
    const dmaResult = week52?.closes ? calculateDMA(week52.closes, price) : null;
    const srResult =
      week52?.recentHighs && week52.recentLows
        ? calculateSupportResistance(week52.recentLows, week52.recentHighs, price)
        : null;

    const raw = await withTimeout(
      withRetry(() => callGPT({
        prompt: buildTechnicalsPrompt(
          symbol,
          price,
          rsiResult?.rsi ?? null,
          rsiResult?.rsiTrend ?? null,
          dmaResult?.ma50 ?? null,
          dmaResult?.ma200 ?? null,
          srResult?.support ?? null,
          srResult?.resistance ?? null,
          week52?.high52w ?? null,
          week52?.low52w ?? null
        ),
        useWebSearch: false,
        section: 'technicals',
        symbol,
      })),
      SECTION_TIMEOUT_MS
    );
    const data = validateSection(TechnicalsSchema, raw, 'technicals');

    setCached(cacheKey, data);
    console.log(`[ai:technicals] symbol=${symbol} total=${Date.now() - start}ms`);
    return res.json(data);
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

    // Use cached section results to synthesize verdict (same as orchestrator pipeline)
    const foundationCached = getCached(`foundation:${symbol}`) as OrchestratorFoundation | null;
    const valuationCached = getCached(`valuation:${symbol}`) as OrchestratorValuation | null;
    const risksCached = getCached(`risks:${symbol}`) as OrchestratorRisks | null;
    const technicalsCached = getCached(`technicals:${symbol}`) as OrchestratorTechnicals | null;

    let prompt: string;
    if (foundationCached && valuationCached && risksCached && technicalsCached) {
      const normalized: Record<SectionSSEKey, NormalizedModuleOutput> = {
        research_foundation: normalizeFoundation(foundationCached),
        valuation_financials: normalizeValuation(valuationCached),
        risk_red_teaming: normalizeRisks(risksCached),
        technicals: normalizeTechnicals(technicalsCached),
      };
      prompt = buildVerdictFromModulesPrompt(symbol, companyName, normalized);
    } else {
      prompt = buildVerdictPrompt(symbol, companyName);
    }

    const raw = await withTimeout(
      withRetry(() => callGPT({ prompt, useWebSearch: false, section: 'verdict', symbol })),
      SECTION_TIMEOUT_MS
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
    await runResearchPipeline(symbol, send);
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : 'Pipeline failed' });
  } finally {
    if (!closed) res.end();
  }
});

export default router;
