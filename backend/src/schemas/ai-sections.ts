import { z } from 'zod';

/**
 * Base schema mixed into every section output.
 * confidence_score is injected server-side after validation — GPT does not produce it.
 * data_freshness indicates whether the underlying data is current, stale, or unavailable.
 */
const BaseSectionMeta = z.object({
  confidence_score: z.number().min(0).max(100).optional(),
  data_freshness: z.enum(['CURRENT', 'STALE', 'UNAVAILABLE']).optional(),
});

export const FoundationSchema = BaseSectionMeta.merge(z.object({
  verdict: z.enum(['Strong', 'Moderate', 'Weak']),
  business_model: z.array(z.string()),
  moat: z.array(z.string()),
  catalysts: z.array(z.string()),
  asymmetry: z.array(z.string()),
  insights: z.array(z.string()),
})).passthrough();

export const ValuationSchema = BaseSectionMeta.merge(z.object({
  verdict: z.enum(['Positive', 'Neutral', 'Negative']),
  relative_valuation: z.array(z.string()),
  growth_metrics: z.array(z.string()),
  financial_health: z.array(z.string()),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.string(),
    note: z.string(),
  })),
})).passthrough();

export const RisksSchema = BaseSectionMeta.merge(z.object({
  verdict: z.enum(['Low', 'Moderate', 'Elevated', 'High']),
  bear_case: z.array(z.string()),
  sec_flags: z.array(z.string()),
  customer_concentration: z.array(z.string()),
  risks: z.array(z.object({
    label: z.string(),
    description: z.string(),
  })),
})).passthrough();

export const TechnicalsSchema = BaseSectionMeta.merge(z.object({
  verdict: z.enum(['Bullish', 'Neutral', 'Bearish']),
  price_trend: z.array(z.string()),
  moving_averages: z.array(z.string()),
  rsi: z.array(z.string()),
  support_resistance: z.array(z.string()),
  technical_view: z.array(z.string()),
})).passthrough();

export const VerdictSchema = BaseSectionMeta.merge(z.object({
  overall: z.enum(['Strongly Bullish', 'Moderately Bullish', 'Neutral', 'Moderately Bearish', 'Strongly Bearish']),
  summary: z.array(z.string()),
  key_drivers: z.array(z.string()),
  key_risks: z.array(z.string()),
  catalysts: z.array(z.string()),
})).passthrough();

// ─── Decent tier schemas ──────────────────────────────────────────────────────

export const PeerComparisonSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  comparison_table: z.array(z.object({
    symbol: z.string(),
    ps_ttm: z.string(),
    ps_forward: z.string(),
    ev_ebitda: z.string(),
    gross_margin: z.string(),
    revenue_growth: z.string(),
    value_growth_score: z.string(),
  })),
  insights: z.array(z.string()),
})).passthrough();

export const RuleOf40Schema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  current_score: z.string(),
  trend: z.string(),
  quarterly_data: z.array(z.object({
    quarter: z.string(),
    revenue_growth: z.string(),
    ebitda_margin: z.string(),
    score: z.string(),
  })),
  insights: z.array(z.string()),
})).passthrough();

export const ForwardPSSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  ttm_ps: z.string(),
  forward_ps: z.string(),
  guidance: z.string(),
  stress_test: z.array(z.string()),
  insights: z.array(z.string()),
})).passthrough();

export const CustomerConcentrationSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  concentration_pct: z.string(),
  top_customers: z.array(z.object({
    rank: z.string(),
    revenue_pct: z.string(),
    trend: z.string(),
  })),
  insights: z.array(z.string()),
})).passthrough();

export const ShortSellerPerspectiveSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  bear_thesis: z.array(z.string()),
  short_catalysts: z.array(z.string()),
  counter_arguments: z.array(z.string()),
})).passthrough();

export const HistoricalPSSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  current_ps: z.string(),
  min_3y: z.string(),
  max_3y: z.string(),
  avg_3y: z.string(),
  percentile: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const InsiderOwnershipSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  insider_ownership_pct: z.string(),
  industry_avg: z.string(),
  sbc_pct_revenue: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const AsymmetryAnalysisSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  downside_floor: z.string(),
  upside_ceiling: z.string(),
  risk_reward_ratio: z.string(),
  base_case: z.array(z.string()),
  bull_case: z.array(z.string()),
  bear_case: z.array(z.string()),
})).passthrough();

// ─── In-depth tier schemas ────────────────────────────────────────────────────

export const RelativeStrengthSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  rs_3m_trend: z.string(),
  breakout_breakdown: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const ShortInterestSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  short_interest_pct: z.string(),
  days_to_cover: z.string(),
  trend_12m: z.string(),
  squeeze_potential: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const RetailSentimentSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  sentiment_score: z.string(),
  stocktwits_sentiment: z.string(),
  reddit_sentiment: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const VolumePatternsSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  recent_patterns: z.array(z.string()),
  breakout_breakdown: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const BullCaseCritiqueSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  bull_thesis: z.array(z.string()),
  critique_points: z.array(z.string()),
  market_discount_reason: z.array(z.string()),
})).passthrough();

export const EarningsMissSchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  last_miss_date: z.string(),
  miss_reason: z.string(),
  stock_reaction: z.string(),
  insights: z.array(z.string()),
})).passthrough();

export const ImpliedVolatilitySchema = BaseSectionMeta.merge(z.object({
  verdict: z.string(),
  current_iv: z.string(),
  historical_iv: z.string(),
  iv_percentile: z.string(),
  insights: z.array(z.string()),
})).passthrough();

// ─── Type exports ─────────────────────────────────────────────────────────────

export type FoundationShape = z.infer<typeof FoundationSchema>;
export type ValuationShape = z.infer<typeof ValuationSchema>;
export type RisksShape = z.infer<typeof RisksSchema>;
export type TechnicalsShape = z.infer<typeof TechnicalsSchema>;
export type VerdictShape = z.infer<typeof VerdictSchema>;
export type PeerComparisonShape = z.infer<typeof PeerComparisonSchema>;
export type RuleOf40Shape = z.infer<typeof RuleOf40Schema>;
export type ForwardPSShape = z.infer<typeof ForwardPSSchema>;
export type CustomerConcentrationShape = z.infer<typeof CustomerConcentrationSchema>;
export type ShortSellerPerspectiveShape = z.infer<typeof ShortSellerPerspectiveSchema>;
export type HistoricalPSShape = z.infer<typeof HistoricalPSSchema>;
export type InsiderOwnershipShape = z.infer<typeof InsiderOwnershipSchema>;
export type AsymmetryAnalysisShape = z.infer<typeof AsymmetryAnalysisSchema>;
export type RelativeStrengthShape = z.infer<typeof RelativeStrengthSchema>;
export type ShortInterestShape = z.infer<typeof ShortInterestSchema>;
export type RetailSentimentShape = z.infer<typeof RetailSentimentSchema>;
export type VolumePatternsShape = z.infer<typeof VolumePatternsSchema>;
export type BullCaseCritiqueShape = z.infer<typeof BullCaseCritiqueSchema>;
export type EarningsMissShape = z.infer<typeof EarningsMissSchema>;
export type ImpliedVolatilityShape = z.infer<typeof ImpliedVolatilitySchema>;

export function validateSection<T>(schema: z.ZodType<T>, data: unknown, section: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Schema validation failed for ${section}: ${result.error.issues.map(i => i.message).join(', ')}`);
  }
  return result.data;
}
