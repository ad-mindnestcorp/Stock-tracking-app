import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { marketApi, watchlistApi, type StockDetail, type CandleData } from '@/lib/api';
import { Colors, Radius } from '@/constants/theme';
import LineChart from '@/components/line-chart';

type Range = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
const RANGES: Range[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { width } = useWindowDimensions();

  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [candles, setCandles] = useState<CandleData | null>(null);
  const [selectedRange, setSelectedRange] = useState<Range>('1M');
  const [loading, setLoading] = useState(true);
  const [candleLoading, setCandleLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!symbol) return;
    try {
      setError(null);
      const data = await marketApi.getDetail(symbol);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const loadCandles = useCallback(async (range: Range) => {
    if (!symbol) return;
    setCandleLoading(true);
    try {
      const data = await marketApi.getCandles(symbol, range);
      setCandles(data);
    } catch {
      setCandles(null);
    } finally {
      setCandleLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadDetail();
    loadCandles('1M');
  }, [loadDetail, loadCandles]);

  const handleRangeChange = (range: Range) => {
    setSelectedRange(range);
    loadCandles(range);
  };

  const handleWatchlistToggle = async () => {
    if (!symbol) return;
    try {
      if (inWatchlist) {
        await watchlistApi.remove(symbol);
        setInWatchlist(false);
      } else {
        await watchlistApi.add(symbol, detail?.profile?.name);
        setInWatchlist(true);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update watchlist');
    }
  };

  const chartColor = (detail?.changePercent ?? 0) >= 0 ? Colors.positive : Colors.negative;
  const isPositive = (detail?.changePercent ?? 0) >= 0;
  const chartWidth = width - 40;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading {symbol}...</Text>
      </SafeAreaView>
    );
  }

  if (error || !detail) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.negative} />
        <Text style={styles.errorText}>{error ?? 'Stock not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const changeColor = isPositive ? Colors.positive : Colors.negative;

  // RSI color
  const getRsiColor = () => {
    if (detail.isOverbought) return Colors.alertRsiOB;
    if (detail.isOversold) return Colors.alertRsiOS;
    return Colors.textSecondary;
  };

  const getRsiLabel = () => {
    if (detail.isOverbought) return 'OVERBOUGHT';
    if (detail.isOversold) return 'OVERSOLD';
    return 'NEUTRAL';
  };

  // 52W progress
  const week52Range = (detail.week52High ?? 0) - (detail.week52Low ?? 0);
  const pricePosition =
    week52Range > 0
      ? ((detail.currentPrice - (detail.week52Low ?? 0)) / week52Range) * 100
      : 50;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Nav bar */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.dark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.navBtn} onPress={handleWatchlistToggle}>
            <Ionicons
              name={inWatchlist ? 'star' : 'star-outline'}
              size={22}
              color={inWatchlist ? Colors.primary : Colors.dark}
            />
          </TouchableOpacity>
        </View>

        {/* Company info */}
        <View style={styles.companyRow}>
          <View style={styles.companyLogo}>
            <Text style={styles.companyLogoText}>{symbol?.slice(0, 2)}</Text>
          </View>
          <View>
            <Text style={styles.symbolText}>{symbol}</Text>
            <Text style={styles.companyName} numberOfLines={1}>
              {detail.profile?.name ?? symbol}
            </Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceSection}>
          <Text style={styles.price}>${detail.currentPrice.toFixed(2)}</Text>
          <View style={styles.changeRow}>
            <Ionicons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={18}
              color={changeColor}
            />
            <Text style={[styles.change, { color: changeColor }]}>
              {isPositive ? '+' : ''}{detail.change?.toFixed(2)} ({isPositive ? '+' : ''}
              {detail.changePercent?.toFixed(2)}%)
            </Text>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartSection}>
          {candleLoading ? (
            <View style={[styles.chartPlaceholder, { width: chartWidth }]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : candles && candles.close.length > 1 ? (
            <LineChart
              data={candles.close}
              width={chartWidth}
              height={160}
              color={chartColor}
            />
          ) : (
            <View style={[styles.chartPlaceholder, { width: chartWidth }]}>
              <Text style={styles.noChartText}>Chart unavailable</Text>
            </View>
          )}

          {/* Range selector */}
          <View style={styles.ranges}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeBtn, selectedRange === r && styles.rangeBtnActive]}
                onPress={() => handleRangeChange(r)}
              >
                <Text style={[styles.rangeText, selectedRange === r && styles.rangeTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Key Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>Key Statistics</Text>

          <View style={styles.statsGrid}>
            <StatItem label="Open" value={`$${detail.open?.toFixed(2) ?? '—'}`} />
            <StatItem label="High" value={`$${detail.high?.toFixed(2) ?? '—'}`} />
            <StatItem label="Low" value={`$${detail.low?.toFixed(2) ?? '—'}`} />
            <StatItem label="Prev Close" value={`$${detail.previousClose?.toFixed(2) ?? '—'}`} />
          </View>

          {/* RSI */}
          {detail.rsi != null && (
            <View style={styles.rsiCard}>
              <View style={styles.rsiRow}>
                <Text style={styles.rsiLabel}>RSI-14</Text>
                <View style={[styles.rsiBadge, { backgroundColor: getRsiColor() + '20' }]}>
                  <Text style={[styles.rsiBadgeText, { color: getRsiColor() }]}>{getRsiLabel()}</Text>
                </View>
              </View>
              <Text style={[styles.rsiValue, { color: getRsiColor() }]}>
                {detail.rsi.toFixed(1)}
              </Text>
              <View style={styles.rsiBar}>
                <View style={styles.rsiBarBg} />
                <View
                  style={[
                    styles.rsiBarFill,
                    { width: `${Math.min(detail.rsi, 100)}%`, backgroundColor: getRsiColor() },
                  ]}
                />
                <View style={[styles.rsiMark, { left: '30%' }]} />
                <View style={[styles.rsiMark, { left: '70%' }]} />
              </View>
              <View style={styles.rsiBarLabels}>
                <Text style={styles.rsiBarLabel}>0</Text>
                <Text style={[styles.rsiBarLabel, { color: Colors.alertRsiOS }]}>30</Text>
                <Text style={[styles.rsiBarLabel, { color: Colors.alertRsiOB }]}>70</Text>
                <Text style={styles.rsiBarLabel}>100</Text>
              </View>
            </View>
          )}

          {/* 52-week range */}
          {detail.week52High != null && detail.week52Low != null && (
            <View style={styles.week52Card}>
              <Text style={styles.week52Title}>52-Week Range</Text>
              <View style={styles.week52Row}>
                <Text style={[styles.week52Val, { color: Colors.negative }]}>
                  ${detail.week52Low.toFixed(2)}
                </Text>
                <Text style={[styles.week52Val, { color: Colors.positive }]}>
                  ${detail.week52High.toFixed(2)}
                </Text>
              </View>
              <View style={styles.week52BarBg}>
                <View
                  style={[
                    styles.week52BarFill,
                    { width: `${Math.min(Math.max(pricePosition, 2), 98)}%` },
                  ]}
                />
              </View>
              <View style={styles.week52SubRow}>
                <Text style={styles.week52Sub}>LOW</Text>
                <Text style={styles.week52Current}>${detail.currentPrice.toFixed(2)}</Text>
                <Text style={styles.week52Sub}>HIGH</Text>
              </View>
            </View>
          )}
        </View>

        {/* Add to Watchlist CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.ctaBtn, inWatchlist && styles.ctaBtnActive]}
            onPress={handleWatchlistToggle}
          >
            <Ionicons
              name={inWatchlist ? 'star' : 'star-outline'}
              size={20}
              color={inWatchlist ? Colors.dark : Colors.dark}
            />
            <Text style={styles.ctaBtnText}>
              {inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
  errorText: { marginTop: 12, color: Colors.negative, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  backBtn: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.full },
  backBtnText: { fontSize: 15, fontWeight: '700', color: Colors.dark },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  companyLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyLogoText: { fontSize: 16, fontWeight: '800', color: Colors.dark },
  symbolText: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  companyName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, maxWidth: 220 },

  priceSection: { paddingHorizontal: 20, marginBottom: 16 },
  price: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  change: { fontSize: 15, fontWeight: '600' },

  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  chartPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: 12,
  },
  noChartText: { color: Colors.textMuted, fontSize: 13 },

  ranges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    justifyContent: 'space-between',
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  rangeBtnActive: { backgroundColor: Colors.dark },
  rangeText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  rangeTextActive: { color: Colors.primary },

  statsSection: { paddingHorizontal: 20, marginBottom: 24 },
  statsTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statItem: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
  },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },

  rsiCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 12,
  },
  rsiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rsiLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  rsiBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  rsiBadgeText: { fontSize: 10, fontWeight: '700' },
  rsiValue: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  rsiBar: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative', marginBottom: 6 },
  rsiBarBg: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.border, borderRadius: 3 },
  rsiBarFill: { height: 6, borderRadius: 3 },
  rsiMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  rsiBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rsiBarLabel: { fontSize: 10, color: Colors.textMuted },

  week52Card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
  },
  week52Title: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  week52Row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  week52Val: { fontSize: 15, fontWeight: '700' },
  week52BarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  week52BarFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  week52SubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  week52Sub: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  week52Current: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  ctaSection: { paddingHorizontal: 20, paddingBottom: 32 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
  },
  ctaBtnActive: { backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: Colors.dark },
});
