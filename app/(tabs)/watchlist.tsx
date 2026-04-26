import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useWatchlist, useAddStock, useRemoveStock } from '@/hooks/use-watchlist';
import { watchlistApi, type WatchlistStock, type StockSearchResult } from '@/lib/api';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';
import { SkeletonListScreen } from '@/components/skeleton';

export default function WatchlistScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: stocks = [], isLoading, isError, error, refetch, isRefetching } = useWatchlist();
  const { mutate: addStock } = useAddStock();
  const { mutate: removeStock } = useRemoveStock();

  const handleDelete = (symbol: string) => {
    Alert.alert(
      'Remove Stock',
      `Remove ${symbol} from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeStock(symbol),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <Text style={styles.subtitle}>{stocks.length} stock{stocks.length !== 1 ? 's' : ''} monitored</Text>
      </View>

      {/* Search + add input */}
      <StockSearchInput
        watchedSymbols={stocks.map((s) => s.symbol)}
        onAdd={(symbol, company_name) => addStock({ symbol, company_name })}
        colors={colors}
        styles={styles}
      />

      {isError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Failed to load watchlist'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <SkeletonListScreen count={5} />
      ) : stocks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={56} color={colors.border} />
          <Text style={styles.emptyTitle}>No stocks yet</Text>
          <Text style={styles.emptyText}>
            Add stock symbols above to start monitoring for RSI and 52-week alerts.
          </Text>
        </View>
      ) : (
        <FlatList
          data={stocks}
          keyExtractor={(item) => item.symbol}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WatchlistRow stock={item} onDelete={handleDelete} colors={colors} styles={styles} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function StockSearchInput({
  watchedSymbols,
  onAdd,
  colors,
  styles,
}: {
  watchedSymbols: string[];
  onAdd: (symbol: string, company_name: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setDebouncedQuery('');
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setOpen(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['stockSearch', debouncedQuery],
    queryFn: () => watchlistApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  });

  const handleSelect = (item: StockSearchResult) => {
    onAdd(item.symbol, item.description);
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
  };

  const showDropdown = open && debouncedQuery.length >= 1;

  return (
    <View style={styles.searchContainer}>
      <View style={styles.addRow} accessibilityRole="search">
        <Ionicons
          name="search"
          size={18}
          color={colors.textMuted}
          style={styles.searchIcon}
          accessibilityElementsHidden
        />
        <TextInput
          style={styles.input}
          placeholder="Search symbol or company…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          returnKeyType="search"
          accessibilityLabel="Stock search input"
          accessibilityHint="Type a symbol or company name to find and add stocks"
        />
        {isFetching && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.searchSpinner} />
        )}
        {query.length > 0 && !isFetching && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setDebouncedQuery('');
              setOpen(false);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {results.length === 0 && !isFetching ? (
            <Text style={styles.dropdownEmpty}>No results for &ldquo;{debouncedQuery}&rdquo;</Text>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 220 }}
              showsVerticalScrollIndicator={false}
            >
              {results.map((item) => {
                const alreadyAdded = watchedSymbols.includes(item.symbol);
                return (
                  <TouchableOpacity
                    key={item.symbol}
                    style={[styles.dropdownRow, alreadyAdded && styles.dropdownRowDisabled]}
                    onPress={() => !alreadyAdded && handleSelect(item)}
                    disabled={alreadyAdded}
                    accessibilityRole="button"
                    accessibilityLabel={
                      alreadyAdded
                        ? `${item.symbol} already in watchlist`
                        : `Add ${item.symbol} to watchlist`
                    }
                    accessibilityState={{ disabled: alreadyAdded }}
                  >
                    <View style={styles.dropdownInfo}>
                      <Text style={styles.dropdownSymbol}>{item.symbol}</Text>
                      <Text style={styles.dropdownName} numberOfLines={1}>
                        {item.description}
                      </Text>
                    </View>
                    {alreadyAdded ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.positive} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function calc52WeekPercent(price: number, low: number, high: number): number {
  if (high === low) return 0;
  return Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
}

function get52WeekColor(pct: number, positive: string, negative: string): string {
  if (pct <= 30) return positive;
  if (pct <= 70) return '#F59E0B';
  return negative;
}


function WatchlistRow({
  stock,
  onDelete,
  colors,
  styles,
}: {
  stock: WatchlistStock;
  onDelete: (symbol: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const quote = stock.quote;
  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;
  const rsiColor = stock.isOverbought
    ? colors.negative
    : stock.isOversold
      ? colors.positive
      : colors.textMuted;

  const show52Week =
    quote != null &&
    stock.week52High != null &&
    stock.week52Low != null;

  const pct52 = show52Week
    ? calc52WeekPercent(quote!.currentPrice, stock.week52Low!, stock.week52High!)
    : null;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/stock/${stock.symbol}`)}
      onLongPress={() => onDelete(stock.symbol)}
      activeOpacity={0.7}
    >
      {/* Top: logo / info / price / delete */}
      <View style={styles.rowTop}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>{stock.symbol.slice(0, 2)}</Text>
        </View>

        <View style={styles.rowInfo}>
          <Text style={styles.rowSymbol}>{stock.symbol}</Text>
          <Text style={styles.rowName} numberOfLines={1}>
            {stock.company_name ?? stock.symbol}
          </Text>
        </View>

        <View style={styles.rowPrice}>
          {quote ? (
            <>
              <Text style={styles.priceText}>${quote.currentPrice.toFixed(2)}</Text>
              <Text style={[styles.changeText, { color: changeColor }]}>
                {isPositive ? '+' : ''}{(quote.changePercent ?? 0).toFixed(2)}%
              </Text>
            </>
          ) : (
            <Text style={styles.noData}>Loading...</Text>
          )}
          {(stock.rsi != null || pct52 != null) && (
            <View style={styles.rsiRow}>
              {pct52 != null && (
                <Text style={styles.rsiText}>
                  <Text style={{ color: '#ffffff' }}>52W </Text>
                  <Text style={{ color: get52WeekColor(pct52, colors.positive, colors.negative) }}>{pct52.toFixed(0)}%</Text>
                </Text>
              )}
              {stock.rsi != null && (
                <View style={styles.rsiInlineRow}>
                  <Text style={styles.rsiText}>
                    <Text style={{ color: '#ffffff' }}>RSI </Text>
                    <Text style={{ color: rsiColor }}>{stock.rsi.toFixed(1)}</Text>
                  </Text>
                  {stock.rsiTrend === 'up' && (
                    <Ionicons name="arrow-up" size={11} color={colors.positive} style={styles.rsiInlineArrow} />
                  )}
                  {stock.rsiTrend === 'down' && (
                    <Ionicons name="arrow-down" size={11} color={colors.negative} style={styles.rsiInlineArrow} />
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(stock.symbol)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.negative} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    searchContainer: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      zIndex: 10,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.full,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    searchIcon: { marginRight: 2 },
    searchSpinner: { marginLeft: 4 },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 2,
    },
    dropdown: {
      marginTop: 6,
      borderRadius: Radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    dropdownEmpty: {
      padding: 16,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    dropdownRowDisabled: { opacity: 0.5 },
    dropdownInfo: { flex: 1 },
    dropdownSymbol: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    dropdownName: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

    errorCard: {
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: '#FEF2F2',
      borderRadius: Radius.md,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    errorText: { color: colors.negative, fontSize: 13 },
    retryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    list: { paddingHorizontal: 20, paddingBottom: 20 },

    row: {
      flexDirection: 'column',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    rowInfo: { flex: 1 },
    rowSymbol: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    rowName: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    rowPrice: { alignItems: 'flex-end' },
    priceText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    changeText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    rsiText: { fontSize: 11, fontWeight: '600' },
    rsiInlineRow: { flexDirection: 'row', alignItems: 'center' },
    rsiInlineArrow: { marginLeft: 2 },
    rsiRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
    noData: { fontSize: 12, color: colors.textMuted },
    deleteBtn: { padding: 4 },
  });
}
