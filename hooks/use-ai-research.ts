import { useQuery } from '@tanstack/react-query';
import { aiApi } from '@/lib/api';
import type {
  AIResearchSections,
  SectionState,
  AIStockSummary,
  AIResearchFoundation,
  AIValuationFinancials,
  AIRiskRedTeaming,
  AITechnicals,
  AIVerdict,
  ResearchTier,
  SectionKey,
  TIER_SECTIONS,
} from '@/lib/ai-types';
import { TIER_SECTIONS as TIER_SECTIONS_MAP } from '@/lib/ai-types';

const STALE_TIME = 6 * 60 * 60 * 1000;
const GC_TIME = 6 * 60 * 60 * 1000;

function toSectionState<T>(query: {
  status: 'pending' | 'error' | 'success';
  isFetching: boolean;
  data?: T;
  error: Error | null;
  refetch: () => void;
}): SectionState<T> {
  if (query.isFetching) return { status: 'loading', refetch: query.refetch };
  if (query.status === 'success') return { status: 'success', data: query.data, refetch: query.refetch };
  if (query.status === 'error') return { status: 'error', error: query.error?.message ?? 'Failed', refetch: query.refetch };
  return { status: 'idle', refetch: query.refetch };
}

export function useAIResearch(symbol: string | null, tier: ResearchTier | null = 'basic'): AIResearchSections {
  const enabled = !!symbol && !!tier;
  const sectionsForTier = tier ? TIER_SECTIONS_MAP[tier] : TIER_SECTIONS_MAP.basic;

  const summaryQuery = useQuery({
    queryKey: ['ai:summary', symbol, tier],
    queryFn: () => aiApi.getSummary(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const foundationQuery = useQuery({
    queryKey: ['ai:foundation', symbol, tier],
    queryFn: () => aiApi.getFoundation(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const valuationQuery = useQuery({
    queryKey: ['ai:valuation', symbol, tier],
    queryFn: () => aiApi.getValuation(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const risksQuery = useQuery({
    queryKey: ['ai:risks', symbol, tier],
    queryFn: () => aiApi.getRisks(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const technicalsQuery = useQuery({
    queryKey: ['ai:technicals', symbol, tier],
    queryFn: () => aiApi.getTechnicals(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  // Dynamic sections based on tier (only sections beyond the first 4)
  const additionalSections = sectionsForTier.slice(4);
  
  // Create queries for additional sections
  const peerComparisonQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'peer_comparison'],
    queryFn: () => aiApi.getSection(symbol!, 'peer_comparison'),
    enabled: enabled && additionalSections.includes('peer_comparison'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const ruleOf40Query = useQuery({
    queryKey: ['ai:section', symbol, tier, 'rule_of_40'],
    queryFn: () => aiApi.getSection(symbol!, 'rule_of_40'),
    enabled: enabled && additionalSections.includes('rule_of_40'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const forwardPsQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'forward_ps'],
    queryFn: () => aiApi.getSection(symbol!, 'forward_ps'),
    enabled: enabled && additionalSections.includes('forward_ps'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const customerConcentrationQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'customer_concentration'],
    queryFn: () => aiApi.getSection(symbol!, 'customer_concentration'),
    enabled: enabled && additionalSections.includes('customer_concentration'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const shortSellerPerspectiveQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'short_seller_perspective'],
    queryFn: () => aiApi.getSection(symbol!, 'short_seller_perspective'),
    enabled: enabled && additionalSections.includes('short_seller_perspective'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const historicalPsQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'historical_ps'],
    queryFn: () => aiApi.getSection(symbol!, 'historical_ps'),
    enabled: enabled && additionalSections.includes('historical_ps'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const insiderOwnershipQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'insider_ownership'],
    queryFn: () => aiApi.getSection(symbol!, 'insider_ownership'),
    enabled: enabled && additionalSections.includes('insider_ownership'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const asymmetryAnalysisQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'asymmetry_analysis'],
    queryFn: () => aiApi.getSection(symbol!, 'asymmetry_analysis'),
    enabled: enabled && additionalSections.includes('asymmetry_analysis'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const relativeStrengthQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'relative_strength'],
    queryFn: () => aiApi.getSection(symbol!, 'relative_strength'),
    enabled: enabled && additionalSections.includes('relative_strength'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const shortInterestQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'short_interest'],
    queryFn: () => aiApi.getSection(symbol!, 'short_interest'),
    enabled: enabled && additionalSections.includes('short_interest'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const retailSentimentQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'retail_sentiment'],
    queryFn: () => aiApi.getSection(symbol!, 'retail_sentiment'),
    enabled: enabled && additionalSections.includes('retail_sentiment'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const volumePatternsQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'volume_patterns'],
    queryFn: () => aiApi.getSection(symbol!, 'volume_patterns'),
    enabled: enabled && additionalSections.includes('volume_patterns'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const bullCaseCritiqueQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'bull_case_critique'],
    queryFn: () => aiApi.getSection(symbol!, 'bull_case_critique'),
    enabled: enabled && additionalSections.includes('bull_case_critique'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const earningsMissQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'earnings_miss'],
    queryFn: () => aiApi.getSection(symbol!, 'earnings_miss'),
    enabled: enabled && additionalSections.includes('earnings_miss'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const impliedVolatilityQuery = useQuery({
    queryKey: ['ai:section', symbol, tier, 'implied_volatility'],
    queryFn: () => aiApi.getSection(symbol!, 'implied_volatility'),
    enabled: enabled && additionalSections.includes('implied_volatility'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const sectionsSucceeded =
    foundationQuery.status === 'success' &&
    valuationQuery.status === 'success' &&
    risksQuery.status === 'success' &&
    technicalsQuery.status === 'success';

  const verdictQuery = useQuery({
    queryKey: ['ai:verdict', symbol, tier],
    queryFn: () => aiApi.getVerdict(symbol!),
    enabled: enabled && sectionsSucceeded,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  return {
    summary: toSectionState<AIStockSummary>(summaryQuery as Parameters<typeof toSectionState<AIStockSummary>>[0]),
    research_foundation: toSectionState<AIResearchFoundation>(foundationQuery as Parameters<typeof toSectionState<AIResearchFoundation>>[0]),
    valuation_financials: toSectionState<AIValuationFinancials>(valuationQuery as Parameters<typeof toSectionState<AIValuationFinancials>>[0]),
    risk_red_teaming: toSectionState<AIRiskRedTeaming>(risksQuery as Parameters<typeof toSectionState<AIRiskRedTeaming>>[0]),
    technicals: toSectionState<AITechnicals>(technicalsQuery as Parameters<typeof toSectionState<AITechnicals>>[0]),
    ai_verdict: toSectionState<AIVerdict>(verdictQuery as Parameters<typeof toSectionState<AIVerdict>>[0]),
    peer_comparison: toSectionState(peerComparisonQuery as any),
    rule_of_40: toSectionState(ruleOf40Query as any),
    forward_ps: toSectionState(forwardPsQuery as any),
    customer_concentration: toSectionState(customerConcentrationQuery as any),
    short_seller_perspective: toSectionState(shortSellerPerspectiveQuery as any),
    historical_ps: toSectionState(historicalPsQuery as any),
    insider_ownership: toSectionState(insiderOwnershipQuery as any),
    asymmetry_analysis: toSectionState(asymmetryAnalysisQuery as any),
    relative_strength: toSectionState(relativeStrengthQuery as any),
    short_interest: toSectionState(shortInterestQuery as any),
    retail_sentiment: toSectionState(retailSentimentQuery as any),
    volume_patterns: toSectionState(volumePatternsQuery as any),
    bull_case_critique: toSectionState(bullCaseCritiqueQuery as any),
    earnings_miss: toSectionState(earningsMissQuery as any),
    implied_volatility: toSectionState(impliedVolatilityQuery as any),
  };
}
