export type FoundationVerdict = 'Strong' | 'Moderate' | 'Weak';
export type ValuationVerdict = 'Positive' | 'Neutral' | 'Negative';
export type RiskVerdict = 'Low' | 'Moderate' | 'Elevated' | 'High';
export type TechnicalsVerdict = 'Bullish' | 'Neutral' | 'Bearish';
export type OverallVerdict =
  | 'Strongly Bullish'
  | 'Moderately Bullish'
  | 'Neutral'
  | 'Moderately Bearish'
  | 'Strongly Bearish';

export interface AIMeta {
  symbol: string;
  generatedAt: string;
  cachedUntil: string;
}

export interface AIStockSummary {
  ticker: string;
  companyName: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface AIResearchFoundation {
  verdict: FoundationVerdict;
  business_model: string[];
  moat: string[];
  catalysts: string[];
  asymmetry: string[];
  insights: string[];
}

export interface AIValuationMetric {
  label: string;
  value: string;
  note: string;
}

export interface AIValuationFinancials {
  verdict: ValuationVerdict;
  relative_valuation: string[];
  growth_metrics: string[];
  financial_health: string[];
  metrics: AIValuationMetric[];
}

export interface AIRisk {
  label: string;
  description: string;
}

export interface AIRiskRedTeaming {
  verdict: RiskVerdict;
  bear_case: string[];
  sec_flags: string[];
  customer_concentration: string[];
  risks: AIRisk[];
}

export interface AITechnicals {
  verdict: TechnicalsVerdict;
  price_trend: string[];
  moving_averages: string[];
  rsi: string[];
  support_resistance: string[];
  technical_view: string[];
}

export interface AIVerdict {
  overall: OverallVerdict;
  summary: string[];
  key_drivers: string[];
  key_risks: string[];
  catalysts: string[];
}

export interface AIResearch {
  meta: AIMeta;
  summary: AIStockSummary;
  research_foundation: AIResearchFoundation;
  valuation_financials: AIValuationFinancials;
  risk_red_teaming: AIRiskRedTeaming;
  technicals: AITechnicals;
  ai_verdict: AIVerdict;
}

export type SectionKey =
  | 'research_foundation'
  | 'valuation_financials'
  | 'risk_red_teaming'
  | 'technicals';

export type SectionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface SectionState<T> {
  status: SectionStatus;
  data?: T;
  error?: string;
  refetch?: () => void;
}

export interface AIResearchSections {
  summary: SectionState<AIStockSummary>;
  research_foundation: SectionState<AIResearchFoundation>;
  valuation_financials: SectionState<AIValuationFinancials>;
  risk_red_teaming: SectionState<AIRiskRedTeaming>;
  technicals: SectionState<AITechnicals>;
  ai_verdict: SectionState<AIVerdict>;
}

export interface NormalizedModuleOutput {
  verdict: string;
  bullPoints: string[];
  bearPoints: string[];
  score: number;
  confidence: number;
}

export type ResearchSSEEvent =
  | { event: 'section'; payload: { key: SectionKey; status: 'success'; data: AIResearchFoundation | AIValuationFinancials | AIRiskRedTeaming | AITechnicals } }
  | { event: 'section'; payload: { key: SectionKey; status: 'error'; error: string } }
  | { event: 'verdict'; payload: { status: 'success'; data: AIVerdict } }
  | { event: 'verdict'; payload: { status: 'error'; error: string } }
  | { event: 'done'; payload: Record<string, never> }
  | { event: 'error'; payload: { message: string } };

export const SECTION_META: Record<
  SectionKey,
  { number: number; title: string; description: string; icon: string }
> = {
  research_foundation: {
    number: 1,
    title: 'Research Foundation',
    description: 'Business model, moat, catalysts and asymmetry analysis.',
    icon: 'document-text-outline',
  },
  valuation_financials: {
    number: 2,
    title: 'Valuation & Financials',
    description: 'Relative valuation, growth metrics and financial health.',
    icon: 'pie-chart-outline',
  },
  risk_red_teaming: {
    number: 3,
    title: 'Risk & Red Teaming',
    description: 'Bear case, risks, SEC filing checks and customer concentration.',
    icon: 'shield-outline',
  },
  technicals: {
    number: 4,
    title: 'Technicals',
    description: 'Price trend, moving averages, RSI and support/resistance levels.',
    icon: 'trending-up-outline',
  },
};
