import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useWatchlist } from '@/hooks/use-watchlist';
import { HOME, getChangeColor } from './home-tokens';
import { Skeleton, SectionError, SectionEmpty } from './section-states';
import { formatNumberCompact, formatPercent } from '@/lib/formatters';
import { track } from '@/lib/analytics';

const FALLBACK_TINTS = [
  '#1e3a1e', '#3a1e1e', '#1e2a3a', '#2a2a1e',
  '#2a1a2a', '#1e2a2a', '#3a2a1a', '#1e1e3a',
];

export default function YourStocksPanel() {
  const { data: stocks = [], isLoading, isError, error, refetch } = useWatchlist();

  if (isError && stocks.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>Your Stocks</Text>
        <SectionError message={error?.message} onRetry={refetch} />
      </View>
    );
  }

  if (isLoading && stocks.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>Your Stocks</Text>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skelRow}>
            <Skeleton width={32} height={32} radius={8} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width="40%" height={12} />
              <View style={{ height: 4 }} />
              <Skeleton width="60%" height={10} />
            </View>
            <Skeleton width={56} height={12} />
          </View>
        ))}
      </View>
    );
  }

  if (stocks.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>Your Stocks</Text>
        <SectionEmpty message="Add stocks to your watchlist to see them here" />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Your Stocks</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/watchlist')}
          hitSlop={8}
        >
          <Text style={styles.viewAll}>Manage</Text>
        </TouchableOpacity>
      </View>

      {stocks.slice(0, 8).map((stock) => {
        const changePercent = stock.quote?.changePercent ?? null;
        const currentPrice = stock.quote?.currentPrice ?? null;
        const logo = stock.quote?.profile?.logo;
        const color = getChangeColor(changePercent);
        const initial = stock.symbol.slice(0, 2).toUpperCase();
        const fallbackBg = FALLBACK_TINTS[stock.symbol.charCodeAt(0) % FALLBACK_TINTS.length];

        return (
          <TouchableOpacity
            key={stock.symbol}
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => {
              track('stock_viewed', { symbol: stock.symbol, source: 'home_your_stocks' });
              router.push(`/stock/${stock.symbol}` as never);
            }}
          >
            <View style={[styles.avatar, { backgroundColor: fallbackBg }]}>
              {logo ? (
                <Image
                  source={{ uri: logo }}
                  style={styles.avatarImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.symbol}>{stock.symbol}</Text>
              {stock.company_name ? (
                <Text style={styles.name} numberOfLines={1}>
                  {stock.company_name}
                </Text>
              ) : null}
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>
                {currentPrice != null ? formatNumberCompact(currentPrice) : '—'}
              </Text>
              <Text style={[styles.change, { color }]}>
                {formatPercent(changePercent)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 6 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: HOME.textPrimary,
    marginBottom: 8,
  },
  viewAll: {
    fontSize: 12,
    color: HOME.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.separator,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: HOME.textPrimary, fontWeight: '800', fontSize: 12 },
  info: { flex: 1 },
  symbol: { fontSize: 14, fontWeight: '700', color: HOME.textPrimary },
  name: { fontSize: 11, color: HOME.textMuted, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: 13, fontWeight: '600', color: '#dddddd' },
  change: { fontSize: 12, fontWeight: '700' },
});
