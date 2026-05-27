/** 0-100 confidence score injected server-side after validation. Not produced by GPT. */
export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';

/** Indicates whether the underlying API data is current, stale, or unavailable. */
export type DataFreshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';

/** Base fields added to every section response after server-side validation. */
export interface SectionMeta {
  confidence_score?: number;      // 0–100
  data_freshness?: DataFreshness;
}

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

export interface AIResearchFoundation extends SectionMeta {
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

export interface AIValuationFinancials extends SectionMeta {
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

export interface AIRiskRedTeaming extends SectionMeta {
  verdict: RiskVerdict;
  bear_case: string[];
  sec_flags: string[];
  customer_concentration: string[];
  risks: AIRisk[];
}

export interface AITechnicals extends SectionMeta {
  verdict: TechnicalsVerdict;
  price_trend: string[];
  moving_averages: string[];
  rsi: string[];
  support_resistance: string[];
  technical_view: string[];
}

export interface AIVerdict extends SectionMeta {
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
  // Dynamic sections for decent/indepth tiers
  [key: string]: SectionState<any>;
}

export const TIER_SECTIONS: Record<ResearchTier, SectionKey[]> = {
  basic: [
    'research_foundation',
    'valuation_financials',
    'risk_red_teaming',
    'technicals',
  ],
  decent: [
    'research_foundation',
    'valuation_financials',
    'risk_red_teaming',
    'technicals',
    'peer_comparison',
    'rule_of_40',
    'forward_ps',
    'customer_concentration',
    'short_seller_perspective',
    'historical_ps',
    'insider_ownership',
    'asymmetry_analysis',
  ],
  indepth: [
    'research_foundation',
    'valuation_financials',
    'risk_red_teaming',
    'technicals',
    'peer_comparison',
    'rule_of_40',
    'forward_ps',
    'customer_concentration',
    'short_seller_perspective',
    'historical_ps',
    'insider_ownership',
    'asymmetry_analysis',
    'relative_strength',
    'short_interest',
    'retail_sentiment',
    'volume_patterns',
    'bull_case_critique',
    'earnings_miss',
    'implied_volatility',
  ],
};

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

export const TIER_INFO: Record<ResearchTier, { title: string; description: string; estimatedTime: string; estimatedCost: string; sectionCount: number }> = {
  basic: {
    title: 'Basic Research',
    description: 'Core analysis with foundation, valuation, risks, and technicals',
    estimatedTime: '~30 seconds',
    estimatedCost: '$0.25',
    sectionCount: 4,
  },
  decent: {
    title: 'Decent Research',
    description: 'Enhanced analysis with peer comparison, insider data, and asymmetry',
    estimatedTime: '~2 minutes',
    estimatedCost: '$1.50',
    sectionCount: 12,
  },
  indepth: {
    title: 'In-depth Research',
    description: 'Comprehensive institutional-grade analysis with sentiment and patterns',
    estimatedTime: '~4 minutes',
    estimatedCost: '$3.00',
    sectionCount: 19,
  },
};

export const SECTION_META: Partial<Record<
  SectionKey,
  { number: number; title: string; description: string; icon: string }
>> = {
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
  peer_comparison: {
    number: 5,
    title: 'Competitor Analysis',
    description: 'Compare valuation metrics vs main competitors.',
    icon: 'git-compare-outline',
  },
  rule_of_40: {
    number: 6,
    title: 'Growth Health Check',
    description: 'Rule of 40 score: Are they balancing growth with profitability?',
    icon: 'calculator-outline',
  },
  forward_ps: {
    number: 7,
    title: 'Valuation Outlook',
    description: 'Is the forward valuation attractive if guidance holds?',
    icon: 'trending-up-outline',
  },
  customer_concentration: {
    number: 8,
    title: 'Customer Dependency',
    description: 'How much revenue relies on just a few customers?',
    icon: 'people-outline',
  },
  short_seller_perspective: {
    number: 9,
    title: 'Bear Case View',
    description: 'What are short sellers saying? Should you worry?',
    icon: 'alert-circle-outline',
  },
  historical_ps: {
    number: 10,
    title: 'Valuation History',
    description: 'Is it trading cheap or expensive vs its own history?',
    icon: 'bar-chart-outline',
  },
  insider_ownership: {
    number: 11,
    title: 'Management Alignment',
    description: 'Do insiders own enough skin in the game?',
    icon: 'person-outline',
  },
  asymmetry_analysis: {
    number: 12,
    title: 'Risk vs Reward',
    description: 'What is the downside risk compared to upside potential?',
    icon: 'analytics-outline',
  },
  relative_strength: {
    number: 13,
    title: 'Market Outperformance',
    description: 'Is it beating the S&P 500 lately?',
    icon: 'pulse-outline',
  },
  short_interest: {
    number: 14,
    title: 'Short Squeeze Setup',
    description: 'Is there potential for a short squeeze?',
    icon: 'flash-outline',
  },
  retail_sentiment: {
    number: 15,
    title: 'Social Buzz',
    description: 'What are retail investors saying on Reddit and Stocktwits?',
    icon: 'chatbubbles-outline',
  },
  volume_patterns: {
    number: 16,
    title: 'Trading Activity',
    description: 'Are there unusual volume patterns signaling moves?',
    icon: 'stats-chart-outline',
  },
  bull_case_critique: {
    number: 17,
    title: 'Bull Case Reality Check',
    description: 'Why might the bull thesis be wrong?',
    icon: 'help-circle-outline',
  },
  earnings_miss: {
    number: 18,
    title: 'Earnings Track Record',
    description: 'Have they missed earnings lately? How did the stock react?',
    icon: 'close-circle-outline',
  },
  implied_volatility: {
    number: 19,
    title: 'Options Activity',
    description: 'Is the options market expecting big moves?',
    icon: 'speedometer-outline',
  },
};
