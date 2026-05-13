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
import { useQuery } from '@tanstack/react-query';
import { watchlistApi, type StockSearchResult } from '@/lib/api';
import { HOME } from '@/components/home/home-tokens';

type AnalysisType = 'fundamental' | 'technical';

const ANALYSIS_TYPES: { key: AnalysisType; label: string; icon: string; description: string }[] = [
  {
    key: 'fundamental',
    label: 'Fundamental',
    icon: 'bar-chart-outline',
    description: 'Revenue, earnings, valuation & financial health',
  },
  {
    key: 'technical',
    label: 'Technical',
    icon: 'trending-up-outline',
    description: 'RSI, moving averages, support/resistance & momentum',
  },
];

export default function AIScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType | null>(null);
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

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['stockSearch', debouncedQuery],
    queryFn: () => watchlistApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  });

  const handleSelectStock = (stock: StockSearchResult) => {
    setSelectedStock(stock);
    setQuery(stock.symbol);
    setDropdownOpen(false);
    setDebouncedQuery('');
  };

  const handleClear = () => {
    setSelectedStock(null);
    setQuery('');
    setAnalysisType(null);
    setDropdownOpen(false);
  };

  const showAnalysis = selectedStock && analysisType;

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
            <Text style={styles.title}>AI Research</Text>
            <Text style={styles.subtitle}>Stock analysis at a glance</Text>
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
              {isFetching && (
                <ActivityIndicator size="small" color={HOME.accent} />
              )}
              {query.length > 0 && !isFetching && (
                <TouchableOpacity onPress={handleClear} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={HOME.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropdown */}
            {dropdownOpen && debouncedQuery.length >= 1 && (
              <View style={styles.dropdown}>
                {searchResults.length === 0 && !isFetching ? (
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

          {/* Analysis type pills */}
          {selectedStock && (
            <>
              <View style={styles.selectedCard}>
                <View style={styles.selectedLeft}>
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>
                      {selectedStock.symbol.slice(0, 4)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.selectedSymbol}>{selectedStock.symbol}</Text>
                    <Text style={styles.selectedName} numberOfLines={1}>
                      {selectedStock.description}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleClear} hitSlop={8}>
                  <Ionicons name="close" size={18} color={HOME.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Choose analysis type</Text>
              <View style={styles.pillRow}>
                {ANALYSIS_TYPES.map((type) => {
                  const active = analysisType === type.key;
                  return (
                    <TouchableOpacity
                      key={type.key}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setAnalysisType(type.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={type.icon as any}
                        size={18}
                        color={active ? HOME.bg : HOME.textSecondary}
                        style={styles.pillIcon}
                      />
                      <View>
                        <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                          {type.label}
                        </Text>
                        <Text style={[styles.pillDesc, active && styles.pillDescActive]}>
                          {type.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Analysis result / placeholder */}
          {showAnalysis && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="sparkles-outline" size={18} color={HOME.accent} />
                <Text style={styles.resultTitle}>
                  {selectedStock.symbol} — {analysisType === 'fundamental' ? 'Fundamental' : 'Technical'} Analysis
                </Text>
              </View>
              <View style={styles.comingSoon}>
                <Ionicons name="construct-outline" size={40} color={HOME.textMuted} />
                <Text style={styles.comingSoonTitle}>Analysis coming soon</Text>
                <Text style={styles.comingSoonText}>
                  AI-powered {analysisType} analysis prompts will be wired up in the next update.
                </Text>
              </View>
            </View>
          )}

          {/* Empty state */}
          {!selectedStock && (
            <View style={styles.emptyState}>
              <Ionicons name="search-circle-outline" size={64} color={HOME.textMuted} />
              <Text style={styles.emptyTitle}>Search a stock to begin</Text>
              <Text style={styles.emptyText}>
                Select a ticker and an analysis type to get an AI-generated summary.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HOME.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  header: { paddingTop: 6, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: HOME.textPrimary },
  subtitle: { fontSize: 14, color: HOME.textSecondary, marginTop: 4 },

  searchWrap: { zIndex: 10, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: HOME.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: HOME.textPrimary,
    paddingVertical: 0,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: HOME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOME.border,
    overflow: 'hidden',
  },
  dropdownEmpty: {
    padding: 16,
    fontSize: 13,
    color: HOME.textSecondary,
    textAlign: 'center',
  },
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

  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HOME.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: HOME.border,
  },
  selectedLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: HOME.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: { fontSize: 11, fontWeight: '700', color: HOME.textPrimary },
  selectedSymbol: { fontSize: 15, fontWeight: '700', color: HOME.textPrimary },
  selectedName: { fontSize: 12, color: HOME.textSecondary, marginTop: 2, maxWidth: 220 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: HOME.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillRow: { gap: 10, marginBottom: 24 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: HOME.border,
    gap: 12,
  },
  pillActive: {
    backgroundColor: HOME.accent,
    borderColor: HOME.accent,
  },
  pillIcon: { flexShrink: 0 },
  pillLabel: { fontSize: 15, fontWeight: '700', color: HOME.textPrimary },
  pillLabelActive: { color: HOME.bg },
  pillDesc: { fontSize: 12, color: HOME.textSecondary, marginTop: 2 },
  pillDescActive: { color: HOME.bg },

  resultCard: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  resultTitle: { fontSize: 15, fontWeight: '700', color: HOME.textPrimary },
  comingSoon: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  comingSoonTitle: { fontSize: 16, fontWeight: '700', color: HOME.textSecondary },
  comingSoonText: {
    fontSize: 13,
    color: HOME.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: HOME.textSecondary },
  emptyText: {
    fontSize: 14,
    color: HOME.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});
