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
} from 'react-native';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useWatchlist, useAddStock, useRemoveStock } from '@/hooks/use-watchlist';
import { type WatchlistStock } from '@/lib/api';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';
import { SkeletonListScreen } from '@/components/skeleton';

export default function WatchlistScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [addSymbol, setAddSymbol] = useState('');

  const { data: stocks = [], isLoading, isError, error, refetch, isRefetching } = useWatchlist();
  const { mutate: addStock, isPending: adding } = useAddStock();
  const { mutate: removeStock } = useRemoveStock();

  const handleAdd = () => {
    const sym = addSymbol.trim().toUpperCase();
    if (!sym) return;
    addStock(sym, { onSuccess: () => setAddSymbol('') });
  };

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

      {/* Add stock input */}
      <View style={styles.addRow} accessibilityRole="search">
        <TextInput
          style={styles.input}
          placeholder="Add symbol (e.g. AAPL)"
          placeholderTextColor={colors.textMuted}
          value={addSymbol}
          onChangeText={setAddSymbol}
          autoCapitalize="characters"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          accessibilityLabel="Stock symbol input"
          accessibilityHint="Type a stock symbol to add to your watchlist"
        />
        <TouchableOpacity
          style={[styles.addBtn, (!addSymbol.trim() || adding) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!addSymbol.trim() || adding}
          accessibilityRole="button"
          accessibilityLabel={adding ? 'Adding stock…' : 'Add stock to watchlist'}
          accessibilityState={{ disabled: !addSymbol.trim() || adding }}
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} accessibilityElementsHidden />
        </TouchableOpacity>
      </View>

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

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/stock/${stock.symbol}`)}
      onLongPress={() => onDelete(stock.symbol)}
      activeOpacity={0.7}
    >
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
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(stock.symbol)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.negative} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.full,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.textPrimary,
    },
    addBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnDisabled: { opacity: 0.5 },

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
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    noData: { fontSize: 12, color: colors.textMuted },
    deleteBtn: { padding: 4 },
  });
}
