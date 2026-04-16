import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { watchlistApi, type WatchlistStock } from '@/lib/api';
import { Colors, Radius } from '@/constants/theme';

export default function WatchlistScreen() {
  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSymbol, setAddSymbol] = useState('');
  const [adding, setAdding] = useState(false);

  const loadStocks = useCallback(async () => {
    try {
      setError(null);
      const data = await watchlistApi.getAll();
      setStocks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStocks();
  };

  const handleAdd = async () => {
    const sym = addSymbol.trim().toUpperCase();
    if (!sym) return;
    setAdding(true);
    try {
      await watchlistApi.add(sym);
      setAddSymbol('');
      await loadStocks();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add stock');
    } finally {
      setAdding(false);
    }
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
          onPress: async () => {
            try {
              await watchlistApi.remove(symbol);
              setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove');
            }
          },
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
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add symbol (e.g. AAPL)"
          placeholderTextColor={Colors.textMuted}
          value={addSymbol}
          onChangeText={setAddSymbol}
          autoCapitalize="characters"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, (!addSymbol.trim() || adding) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!addSymbol.trim() || adding}
        >
          {adding ? (
            <ActivityIndicator size="small" color={Colors.dark} />
          ) : (
            <Ionicons name="add" size={22} color={Colors.dark} />
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadStocks}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : stocks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={56} color={Colors.border} />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WatchlistRow stock={item} onDelete={handleDelete} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function WatchlistRow({
  stock,
  onDelete,
}: {
  stock: WatchlistStock;
  onDelete: (symbol: string) => void;
}) {
  const quote = stock.quote;
  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const changeColor = isPositive ? Colors.positive : Colors.negative;

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
        <Ionicons name="trash-outline" size={18} color={Colors.negative} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
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
  errorText: { color: Colors.negative, fontSize: 13 },
  retryText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  list: { paddingHorizontal: 20, paddingBottom: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 13, fontWeight: '700', color: Colors.dark },
  rowInfo: { flex: 1 },
  rowSymbol: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  rowName: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rowPrice: { alignItems: 'flex-end' },
  priceText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  changeText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  noData: { fontSize: 12, color: Colors.textMuted },
  deleteBtn: { padding: 4 },
});
