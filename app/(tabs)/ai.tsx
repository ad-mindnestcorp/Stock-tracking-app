import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { watchlistApi, type StockSearchResult } from '@/lib/api';
import { HOME } from '@/components/home/home-tokens';
import { useAIResearch } from '@/hooks/use-ai-research';
import { StockSummaryCard } from '@/components/ai/stock-summary-card';
import { ResearchSectionCard } from '@/components/ai/research-section-card';
import { AIVerdictCard } from '@/components/ai/ai-verdict-card';
import { TierSelectionModal } from '@/components/ai/tier-selection-modal';
import { SECTION_META, TIER_SECTIONS } from '@/lib/ai-types';
import type { SectionKey, SectionState, AIResearchFoundation, AIValuationFinancials, AIRiskRedTeaming, AITechnicals, ResearchTier } from '@/lib/ai-types';

const TABS = ['Overview', 'Financials', 'Risks', 'News', 'Sources'] as const;
type Tab = (typeof TABS)[number];

function getSectionInsightCount(
  state: SectionState<any>,
  key: SectionKey
): number | undefined {
  if (!state.data) return undefined;
  if (key === 'research_foundation') return (state.data as AIResearchFoundation).insights?.length;
  if (key === 'valuation_financials') return (state.data as AIValuationFinancials).metrics?.length;
  if (key === 'risk_red_teaming') return (state.data as AIRiskRedTeaming).risks?.length;
  // For other sections, try to find insights or similar arrays
  if (state.data.insights) return state.data.insights.length;
  return undefined;
}

function getSectionInsightLabel(key: SectionKey): string {
  if (key === 'valuation_financials') return 'key metrics';
  if (key === 'risk_red_teaming') return 'risks identified';
  return 'key insights';
}

function SectionCardWithState({
  sectionKey,
  state,
  onPress,
}: {
  sectionKey: SectionKey;
  state: SectionState<any>;
  onPress: () => void;
}) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <SectionSkeleton sectionKey={sectionKey} />;
  }

  if (state.status === 'error') {
    return (
      <SectionErrorCard
        sectionKey={sectionKey}
        error={state.error ?? 'Failed to load'}
        onRetry={state.refetch}
      />
    );
  }

  if (!state.data) return null;

  return (
    <ResearchSectionCard
      sectionKey={sectionKey}
      verdict={(state.data as { verdict: string }).verdict}
      insightCount={getSectionInsightCount(state, sectionKey)}
      insightLabel={getSectionInsightLabel(sectionKey)}
      onPress={onPress}
    />
  );
}

function SectionSkeleton({ sectionKey }: { sectionKey: SectionKey }) {
  const meta = SECTION_META[sectionKey];
  if (!meta) return null;
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.row}>
        <View style={skeletonStyles.iconWrap}>
          <ActivityIndicator size="small" color={HOME.accent} />
        </View>
        <View style={skeletonStyles.textWrap}>
          <Text style={skeletonStyles.title}>{meta.number}  {meta.title}</Text>
          <Text style={skeletonStyles.desc}>{meta.description}</Text>
        </View>
      </View>
    </View>
  );
}

function SectionErrorCard({
  sectionKey,
  error,
  onRetry,
}: {
  sectionKey: SectionKey;
  error: string;
  onRetry?: () => void;
}) {
  const meta = SECTION_META[sectionKey];
  if (!meta) return null;
  return (
    <View style={errorCardStyles.card}>
      <View style={errorCardStyles.row}>
        <Ionicons name="alert-circle-outline" size={16} color={HOME.negative} />
        <Text style={errorCardStyles.title}>{meta.title}</Text>
      </View>
      <Text style={errorCardStyles.error} numberOfLines={1}>{error}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={errorCardStyles.retryBtn}>
          <Text style={errorCardStyles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function AIScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null);
  const [selectedTier, setSelectedTier] = useState<ResearchTier | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selectedStock) {
      setDebouncedQuery('');
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setDropdownOpen(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedStock]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['stockSearch', debouncedQuery],
    queryFn: () => watchlistApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  });

  const sections = useAIResearch(selectedStock?.symbol ?? null, selectedTier);

  const handleSelectStock = (stock: StockSearchResult) => {
    setSelectedStock(stock);
    setQuery(stock.symbol);
    setDropdownOpen(false);
    setDebouncedQuery('');
    setActiveTab('Overview');
    setSelectedTier(null);
    setShowTierModal(true);
  };

  const handleSelectTier = (tier: ResearchTier) => {
    setSelectedTier(tier);
  };

  const handleClear = () => {
    setSelectedStock(null);
    setSelectedTier(null);
    setQuery('');
    setDropdownOpen(false);
  };

  const handleSectionPress = (sectionKey: SectionKey) => {
    if (!selectedStock) return;
    const sectionState = sections[sectionKey] as SectionState<any>;
    if (!sectionState.data) return;
    router.push({
      pathname: '/ai-detail',
      params: {
        symbol: selectedStock.symbol,
        section: sectionKey,
        data: JSON.stringify(sectionState.data),
      },
    });
  };

  const summaryData = sections.summary.data;
  
  // Get sections for current tier
  const currentTierSections = selectedTier ? TIER_SECTIONS[selectedTier] : TIER_SECTIONS.basic;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>AI Research</Text>
              <Ionicons name="sparkles" size={16} color={HOME.accent} style={{ marginTop: 2 }} />
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={HOME.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search ticker or company…"
                placeholderTextColor={HOME.textSecondary}
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  if (selectedStock) setSelectedStock(null);
                }}
                autoCapitalize="characters"
                returnKeyType="search"
                accessibilityLabel="Stock search"
              />
              {isSearching && <ActivityIndicator size="small" color={HOME.accent} />}
              {query.length > 0 && !isSearching && (
                <TouchableOpacity onPress={handleClear} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={HOME.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropdown */}
            {dropdownOpen && debouncedQuery.length >= 1 && (
              <View style={styles.dropdown}>
                {searchResults.length === 0 && !isSearching ? (
                  <Text style={styles.dropdownEmpty}>No results</Text>
                ) : (
                  searchResults.slice(0, 6).map((item) => (
                    <TouchableOpacity
                      key={item.symbol}
                      style={styles.dropdownRow}
                      onPress={() => handleSelectStock(item)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.dropdownSymbol}>{item.symbol}</Text>
                      <Text style={styles.dropdownName} numberOfLines={1}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Tier selection modal */}
          <TierSelectionModal
            visible={showTierModal}
            onClose={() => setShowTierModal(false)}
            onSelectTier={handleSelectTier}
          />

          {/* Stock selected: show full research UI */}
          {selectedStock && selectedTier && (
            <>
              {/* Stock summary card */}
              {summaryData ? (
                <StockSummaryCard summary={summaryData} />
              ) : (
                <View style={styles.summaryPlaceholder}>
                  <View style={styles.summaryPlaceholderLeft}>
                    <View style={styles.logoPlaceholder} />
                    <View style={styles.summaryPlaceholderInfo}>
                      <Text style={styles.summarySymbol}>{selectedStock.symbol}</Text>
                      <Text style={styles.summaryName} numberOfLines={1}>
                        {selectedStock.description}
                      </Text>
                    </View>
                  </View>
                  {sections.summary.status === 'loading' && (
                    <ActivityIndicator size="small" color={HOME.accent} />
                  )}
                </View>
              )}

              {/* Tab navigation */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabScroll}
                contentContainerStyle={styles.tabRow}
              >
                {TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === tab }}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Overview tab content */}
              {activeTab === 'Overview' && (
                <>
                  {currentTierSections.map((key) => (
                    <SectionCardWithState
                      key={key}
                      sectionKey={key}
                      state={sections[key] as SectionState<any>}
                      onPress={() => handleSectionPress(key)}
                    />
                  ))}

                  {/* AI Verdict */}
                  {sections.ai_verdict.status === 'loading' || sections.ai_verdict.status === 'idle' ? (
                    <View style={styles.verdictSkeleton}>
                      <ActivityIndicator size="small" color={HOME.accent} />
                      <Text style={styles.verdictSkeletonText}>Generating verdict…</Text>
                    </View>
                  ) : sections.ai_verdict.status === 'error' ? (
                    <View style={styles.verdictError}>
                      <Text style={styles.verdictErrorText}>{sections.ai_verdict.error}</Text>
                      {sections.ai_verdict.refetch && (
                        <TouchableOpacity onPress={sections.ai_verdict.refetch} style={styles.retryInline}>
                          <Text style={styles.retryInlineText}>Retry verdict</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : sections.ai_verdict.data ? (
                    <>
                      <View style={styles.verdictSpacer} />
                      <AIVerdictCard verdict={sections.ai_verdict.data} />
                    </>
                  ) : null}
                </>
              )}

              {/* Non-overview tabs — coming soon */}
              {activeTab !== 'Overview' && (
                <View style={styles.comingSoonBlock}>
                  <Ionicons name="construct-outline" size={36} color={HOME.textMuted} />
                  <Text style={styles.comingSoonTitle}>{activeTab} coming soon</Text>
                  <Text style={styles.comingSoonText}>
                    This tab will be available in the next update.
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Empty state */}
          {!selectedStock && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="sparkles-outline" size={32} color={HOME.accent} />
              </View>
              <Text style={styles.emptyTitle}>AI Stock Research</Text>
              <Text style={styles.emptyText}>
                Search any ticker to get an instant AI-powered institutional research report.
              </Text>
              <View style={styles.emptyFeatures}>
                {['Research Foundation', 'Valuation & Financials', 'Risk & Red Teaming', 'Technicals'].map((f) => (
                  <View key={f} style={styles.emptyFeatureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={HOME.positive} />
                    <Text style={styles.emptyFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: HOME.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 5 },
  title: { fontSize: 14, fontWeight: '700', color: HOME.textPrimary },
  desc: { fontSize: 12, color: HOME.textSecondary },
});

const errorCardStyles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: HOME.negative + '44',
    marginBottom: 10,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '700', color: HOME.textPrimary },
  error: { fontSize: 12, color: HOME.textSecondary },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: HOME.cardElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  retryText: { fontSize: 12, fontWeight: '700', color: HOME.accent },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HOME.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },

  header: { paddingTop: 6, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '700', color: HOME.textPrimary },

  searchWrap: { zIndex: 10, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: HOME.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: HOME.textPrimary, paddingVertical: 0 },
  dropdown: {
    marginTop: 6,
    backgroundColor: HOME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    overflow: 'hidden',
  },
  dropdownEmpty: { padding: 16, fontSize: 13, color: HOME.textSecondary, textAlign: 'center' },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HOME.border,
    gap: 10,
  },
  dropdownSymbol: { fontSize: 14, fontWeight: '700', color: HOME.textPrimary, width: 56 },
  dropdownName: { fontSize: 13, color: HOME.textSecondary, flex: 1 },

  summaryPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 12,
  },
  summaryPlaceholderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: HOME.cardElevated,
  },
  summaryPlaceholderInfo: { gap: 6 },
  summarySymbol: { fontSize: 17, fontWeight: '700', color: HOME.textPrimary },
  summaryName: { fontSize: 12, color: HOME.textSecondary, maxWidth: 200 },

  tabScroll: { marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 4, paddingRight: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HOME.border,
    backgroundColor: HOME.card,
  },
  tabActive: { backgroundColor: HOME.accent, borderColor: HOME.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: HOME.textSecondary },
  tabTextActive: { color: '#fff' },

  verdictSpacer: { height: 6 },
  verdictSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: HOME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HOME.border,
    marginTop: 6,
  },
  verdictSkeletonText: { fontSize: 13, color: HOME.textSecondary },
  verdictError: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.negative + '44',
    marginTop: 6,
    gap: 8,
  },
  verdictErrorText: { fontSize: 13, color: HOME.textSecondary },
  retryInline: {
    alignSelf: 'flex-start',
    backgroundColor: HOME.cardElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryInlineText: { fontSize: 12, fontWeight: '700', color: HOME.accent },

  comingSoonBlock: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  comingSoonTitle: { fontSize: 16, fontWeight: '700', color: HOME.textSecondary },
  comingSoonText: { fontSize: 13, color: HOME.textMuted, textAlign: 'center', maxWidth: 240 },

  emptyState: { alignItems: 'center', paddingTop: 56, gap: 14 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: HOME.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: HOME.textPrimary },
  emptyText: { fontSize: 14, color: HOME.textSecondary, textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  emptyFeatures: { gap: 8, marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 32 },
  emptyFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyFeatureText: { fontSize: 13, color: HOME.textSecondary },
});
