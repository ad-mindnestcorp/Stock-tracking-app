import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStockDetail, useCandles, type CandleRange } from '@/hooks/use-stock-detail';
import { useAddStock, useRemoveStock, useWatchlist } from '@/hooks/use-watchlist';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';
import LineChart from '@/components/line-chart';

const RANGES: CandleRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedRange, setSelectedRange] = useState<CandleRange>('1M');

  const { data: detail, isLoading, isError, error } = useStockDetail(symbol ?? '');
  const { data: candles, isLoading: candleLoading } = useCandles(symbol ?? '', selectedRange);
  const { data: watchlist = [] } = useWatchlist();
  const { mutate: addStock } = useAddStock();
  const { mutate: removeStock } = useRemoveStock();

  const inWatchlist = watchlist.some((s) => s.symbol === symbol);
  const chartWidth = width - 40;

  const handleWatchlistToggle = () => {
    if (!symbol) return;
    if (inWatchlist) {
      removeStock(symbol);
    } else {
      addStock(symbol);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading {symbol}...</Text>
      </SafeAreaView>
    );
  }

  if (isError || !detail) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.negative} />
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Stock not found'}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isPositive = (detail.changePercent ?? 0) >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;
  const chartColor = changeColor;

  const getRsiColor = () => {
    if (detail.isOverbought) return colors.alertRsiOB;
    if (detail.isOversold) return colors.alertRsiOS;
    return colors.textSecondary;
  };

  const getRsiLabel = () => {
    if (detail.isOverbought) return 'OVERBOUGHT';
    if (detail.isOversold) return 'OVERSOLD';
    return 'NEUTRAL';
  };

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
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.navBtn} onPress={handleWatchlistToggle}>
            <Ionicons
              name={inWatchlist ? 'star' : 'star-outline'}
              size={22}
              color={inWatchlist ? colors.primary : colors.textPrimary}
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
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : candles && candles.close.length > 1 ? (
            <LineChart data={candles.close} width={chartWidth} height={160} color={chartColor} />
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
                onPress={() => setSelectedRange(r)}
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
            <StatItem label="Open" value={`$${detail.open?.toFixed(2) ?? '—'}`} colors={colors} styles={styles} />
            <StatItem label="High" value={`$${detail.high?.toFixed(2) ?? '—'}`} colors={colors} styles={styles} />
            <StatItem label="Low" value={`$${detail.low?.toFixed(2) ?? '—'}`} colors={colors} styles={styles} />
            <StatItem label="Prev Close" value={`$${detail.previousClose?.toFixed(2) ?? '—'}`} colors={colors} styles={styles} />
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
                <Text style={[styles.rsiBarLabel, { color: colors.alertRsiOS }]}>30</Text>
                <Text style={[styles.rsiBarLabel, { color: colors.alertRsiOB }]}>70</Text>
                <Text style={styles.rsiBarLabel}>100</Text>
              </View>
            </View>
          )}

          {/* 52-week range */}
          {detail.week52High != null && detail.week52Low != null && (
            <View style={styles.week52Card}>
              <Text style={styles.week52Title}>52-Week Range</Text>
              <View style={styles.week52Row}>
                <Text style={[styles.week52Val, { color: colors.negative }]}>
                  ${detail.week52Low.toFixed(2)}
                </Text>
                <Text style={[styles.week52Val, { color: colors.positive }]}>
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
              color={inWatchlist ? colors.textPrimary : colors.onPrimary}
            />
            <Text style={[styles.ctaBtnText, inWatchlist && { color: colors.textPrimary }]}>
              {inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({
  label,
  value,
  colors,
  styles,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
    errorText: {
      marginTop: 12,
      color: colors.negative,
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    backBtn: {
      marginTop: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: Radius.full,
    },
    backBtnText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },

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
      backgroundColor: colors.surface,
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
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companyLogoText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    symbolText: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    companyName: { fontSize: 13, color: colors.textSecondary, marginTop: 2, maxWidth: 220 },

    priceSection: { paddingHorizontal: 20, marginBottom: 16 },
    price: { fontSize: 36, fontWeight: '800', color: colors.textPrimary },
    changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    change: { fontSize: 15, fontWeight: '600' },

    chartSection: { paddingHorizontal: 20, marginBottom: 20 },
    chartPlaceholder: {
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      marginBottom: 12,
    },
    noChartText: { color: colors.textMuted, fontSize: 13 },

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
      backgroundColor: colors.surface,
    },
    rangeBtnActive: { backgroundColor: colors.dark },
    rangeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    rangeTextActive: { color: colors.primary },

    statsSection: { paddingHorizontal: 20, marginBottom: 24 },
    statsTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    statItem: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 14,
    },
    statLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
    statValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

    rsiCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 16,
      marginBottom: 12,
    },
    rsiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    rsiLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    rsiBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    rsiBadgeText: { fontSize: 10, fontWeight: '700' },
    rsiValue: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
    rsiBar: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 6,
    },
    rsiBarBg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.border, borderRadius: 3 },
    rsiBarFill: { height: 6, borderRadius: 3 },
    rsiMark: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    rsiBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    rsiBarLabel: { fontSize: 10, color: colors.textMuted },

    week52Card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 16,
    },
    week52Title: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
    week52Row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    week52Val: { fontSize: 15, fontWeight: '700' },
    week52BarBg: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 6,
    },
    week52BarFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
    week52SubRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    week52Sub: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
    week52Current: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },

    ctaSection: { paddingHorizontal: 20, paddingBottom: 32 },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 16,
    },
    ctaBtnActive: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    ctaBtnText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  });
}
