import { z } from 'zod';

export const FoundationSchema = z.object({
  verdict: z.enum(['Strong', 'Moderate', 'Weak']),
  business_model: z.array(z.string()),
  moat: z.array(z.string()),
  catalysts: z.array(z.string()),
  asymmetry: z.array(z.string()),
  insights: z.array(z.string()),
}).passthrough();

export const ValuationSchema = z.object({
  verdict: z.enum(['Positive', 'Neutral', 'Negative']),
  relative_valuation: z.array(z.string()),
  growth_metrics: z.array(z.string()),
  financial_health: z.array(z.string()),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.string(),
    note: z.string(),
  })),
}).passthrough();

export const RisksSchema = z.object({
  verdict: z.enum(['Low', 'Moderate', 'Elevated', 'High']),
  bear_case: z.array(z.string()),
  sec_flags: z.array(z.string()),
  customer_concentration: z.array(z.string()),
  risks: z.array(z.object({
    label: z.string(),
    description: z.string(),
  })),
}).passthrough();

export const TechnicalsSchema = z.object({
  verdict: z.enum(['Bullish', 'Neutral', 'Bearish']),
  price_trend: z.array(z.string()),
  moving_averages: z.array(z.string()),
  rsi: z.array(z.string()),
  support_resistance: z.array(z.string()),
  technical_view: z.array(z.string()),
}).passthrough();

export const VerdictSchema = z.object({
  overall: z.enum(['Strongly Bullish', 'Moderately Bullish', 'Neutral', 'Moderately Bearish', 'Strongly Bearish']),
  summary: z.array(z.string()),
  key_drivers: z.array(z.string()),
  key_risks: z.array(z.string()),
  catalysts: z.array(z.string()),
}).passthrough();

export type FoundationShape = z.infer<typeof FoundationSchema>;
export type ValuationShape = z.infer<typeof ValuationSchema>;
export type RisksShape = z.infer<typeof RisksSchema>;
export type TechnicalsShape = z.infer<typeof TechnicalsSchema>;
export type VerdictShape = z.infer<typeof VerdictSchema>;

export function validateSection<T>(schema: z.ZodType<T>, data: unknown, section: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Schema validation failed for ${section}: ${result.error.issues.map(i => i.message).join(', ')}`);
  }
  return result.data;
}
