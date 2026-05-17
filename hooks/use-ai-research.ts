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
} from '@/lib/ai-types';

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

export function useAIResearch(symbol: string | null): AIResearchSections {
  const enabled = !!symbol;

  const summaryQuery = useQuery({
    queryKey: ['ai:summary', symbol],
    queryFn: () => aiApi.getSummary(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const foundationQuery = useQuery({
    queryKey: ['ai:foundation', symbol],
    queryFn: () => aiApi.getFoundation(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const valuationQuery = useQuery({
    queryKey: ['ai:valuation', symbol],
    queryFn: () => aiApi.getValuation(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const risksQuery = useQuery({
    queryKey: ['ai:risks', symbol],
    queryFn: () => aiApi.getRisks(symbol!),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const technicalsQuery = useQuery({
    queryKey: ['ai:technicals', symbol],
    queryFn: () => aiApi.getTechnicals(symbol!),
    enabled,
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
    queryKey: ['ai:verdict', symbol],
    queryFn: () => aiApi.getVerdict(symbol!),
    enabled: enabled && sectionsSucceeded,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });

  const summaryState = toSectionState<AIStockSummary>(summaryQuery as Parameters<typeof toSectionState<AIStockSummary>>[0]);

  return {
    summary: summaryState,
    research_foundation: toSectionState<AIResearchFoundation>(foundationQuery as Parameters<typeof toSectionState<AIResearchFoundation>>[0]),
    valuation_financials: toSectionState<AIValuationFinancials>(valuationQuery as Parameters<typeof toSectionState<AIValuationFinancials>>[0]),
    risk_red_teaming: toSectionState<AIRiskRedTeaming>(risksQuery as Parameters<typeof toSectionState<AIRiskRedTeaming>>[0]),
    technicals: toSectionState<AITechnicals>(technicalsQuery as Parameters<typeof toSectionState<AITechnicals>>[0]),
    ai_verdict: toSectionState<AIVerdict>(verdictQuery as Parameters<typeof toSectionState<AIVerdict>>[0]),
  };
}
