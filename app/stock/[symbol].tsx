import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStockDetail, useCandles, type CandleRange } from '@/hooks/use-stock-detail';
import { useAddStock, useRemoveStock, useWatchlist } from '@/hooks/use-watchlist';
import { useTheme } from '@/context/theme-context';
import { Radius, Shadow } from '@/constants/theme';
import LineChart from '@/components/line-chart';

const RANGES: CandleRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

function normalizeSymbolParam(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return (s ?? '').trim().toUpperCase();
}

export default function StockDetailScreen() {
  const { symbol: rawSymbol } = useLocalSearchParams<{ symbol: string | string[] }>();
  const symbol = useMemo(() => normalizeSymbolParam(rawSymbol), [rawSymbol]);
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedRange, setSelectedRange] = useState<CandleRange>('1M');

  const { data: detail, isLoading, isError, error } = useStockDetail(symbol);
  const { data: candles, isLoading: candleLoading } = useCandles(symbol, selectedRange);
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
      addStock({ symbol });
    }
  };

  if (!symbol) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.negative} />
        <Text style={styles.errorText}>Invalid stock symbol</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={`Loading ${symbol}`} />
        <Text style={styles.loadingText}>Loading {symbol}...</Text>
      </SafeAreaView>
    );
  }

  if (isError || !detail) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.negative} />
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Stock not found'}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
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
    return colors.primary;
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

  const chartMin = candles ? Math.min(...candles.close) : null;
  const chartMax = candles ? Math.max(...candles.close) : null;

  const getMomentumColor = (score: number) => {
    if (score >= 70) return colors.positive;
    if (score >= 40) return colors.warning;
    return colors.negative;
  };

  const getMomentumLabel = (score: number) => {
    if (score >= 70) return 'STRONG';
    if (score >= 40) return 'MODERATE';
    return 'WEAK';
  };

  const getSrLabel = () => {
    if (detail.srSignal === 'near_support') return { label: 'NEAR SUPPORT', color: colors.positive, icon: 'trending-up' as const };
    if (detail.srSignal === 'near_resistance') return { label: 'NEAR RESISTANCE', color: colors.negative, icon: 'trending-down' as const };
    return { label: 'NEUTRAL', color: colors.textSecondary, icon: 'remove' as const };
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Nav bar */}
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} accessibilityElementsHidden />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleWatchlistToggle}
            accessibilityRole="button"
            accessibilityLabel={inWatchlist ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
            accessibilityState={{ checked: inWatchlist }}
          >
            <Ionicons
              name={inWatchlist ? 'star' : 'star-outline'}
              size={22}
              color={inWatchlist ? colors.primary : colors.textPrimary}
              accessibilityElementsHidden
            />
          </TouchableOpacity>
        </View>

        {/* Company info + price */}
        <View style={styles.heroSection}>
          <View style={styles.companyRow}>
            <View style={[styles.companyLogo, { borderColor: changeColor + '40' }]}>
              <Text style={styles.companyLogoText}>{symbol?.slice(0, 2)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbolText}>{symbol}</Text>
                {detail.profile?.exchange && (
                  <View style={styles.exchangeBadge}>
                    <Text style={styles.exchangeText}>{detail.profile.exchange}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.companyName} numberOfLines={1}>
                {detail.profile?.name ?? symbol}
              </Text>
            </View>
          </View>

          <Text style={styles.price}>${detail.currentPrice.toFixed(2)}</Text>
          <View style={styles.changeRow}>
            <View style={[styles.changePill, { backgroundColor: changeColor + '18' }]}>
              <Ionicons
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={15}
                color={changeColor}
              />
              <Text style={[styles.change, { color: changeColor }]}>
                {isPositive ? '+' : ''}{detail.change?.toFixed(2)}{'  '}
                ({isPositive ? '+' : ''}{detail.changePercent?.toFixed(2)}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartWrapper}>
            {candleLoading ? (
              <View style={styles.chartPlaceholder}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : candles && candles.close.length > 1 ? (
              <>
                <LineChart data={candles.close} width={chartWidth} height={200} color={chartColor} />
                {chartMax != null && chartMin != null && (
                  <>
                    <Text style={[styles.chartPriceLabel, styles.chartPriceLabelTop]}>
                      ${chartMax.toFixed(2)}
                    </Text>
                    <Text style={[styles.chartPriceLabel, styles.chartPriceLabelBottom]}>
                      ${chartMin.toFixed(2)}
                    </Text>
                  </>
                )}
              </>
            ) : (
              <View style={styles.chartPlaceholder}>
                <Ionicons name="bar-chart-outline" size={32} color={colors.textMuted} />
                <Text style={styles.noChartText}>Chart unavailable</Text>
              </View>
            )}
          </View>

          {/* Range selector */}
          <View style={styles.ranges}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeBtn, selectedRange === r && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                onPress={() => setSelectedRange(r)}
                accessibilityRole="tab"
                accessibilityLabel={`${r} chart range`}
                accessibilityState={{ selected: selectedRange === r }}
              >
                <Text style={[styles.rangeText, selectedRange === r && { color: colors.primary, fontWeight: '700' }]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Technical Indicators */}
        <View style={styles.indicatorsSection}>
          <Text style={styles.sectionTitle}>Technical Indicators</Text>

          {/* MA Row */}
          {(detail.ma50 != null || detail.ma200 != null) && (
            <View style={styles.indicatorRow}>
              {detail.ma50 != null && (
                <View style={[styles.maCard, ...Shadow.card ? [Shadow.card] : []]}>
                  <Text style={styles.indicatorCardLabel}>MA 50</Text>
                  <Text style={styles.indicatorCardValue}>${detail.ma50.toFixed(2)}</Text>
                  <View style={[styles.trendPill, { backgroundColor: (detail.ma50Trend === 'green' ? colors.positive : colors.negative) + '20' }]}>
                    <Ionicons
                      name={detail.ma50Trend === 'green' ? 'arrow-up' : 'arrow-down'}
                      size={11}
                      color={detail.ma50Trend === 'green' ? colors.positive : colors.negative}
                    />
                    <Text style={[styles.trendPillText, { color: detail.ma50Trend === 'green' ? colors.positive : colors.negative }]}>
                      {detail.ma50Trend === 'green' ? 'ABOVE' : 'BELOW'}
                    </Text>
                  </View>
                </View>
              )}
              {detail.ma200 != null && (
                <View style={[styles.maCard, ...Shadow.card ? [Shadow.card] : []]}>
                  <Text style={styles.indicatorCardLabel}>MA 200</Text>
                  <Text style={styles.indicatorCardValue}>${detail.ma200.toFixed(2)}</Text>
                  <View style={[styles.trendPill, { backgroundColor: (detail.ma200Trend === 'green' ? colors.positive : colors.negative) + '20' }]}>
                    <Ionicons
                      name={detail.ma200Trend === 'green' ? 'arrow-up' : 'arrow-down'}
                      size={11}
                      color={detail.ma200Trend === 'green' ? colors.positive : colors.negative}
                    />
                    <Text style={[styles.trendPillText, { color: detail.ma200Trend === 'green' ? colors.positive : colors.negative }]}>
                      {detail.ma200Trend === 'green' ? 'ABOVE' : 'BELOW'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* RSI */}
          {detail.rsi != null && (
            <View style={styles.rsiCard}>
              <View style={styles.rsiRow}>
                <View>
                  <Text style={styles.indicatorCardLabel}>RSI-14</Text>
                  <View style={styles.rsiValueRow}>
                    <Text style={[styles.rsiValue, { color: getRsiColor() }]}>
                      {detail.rsi.toFixed(1)}
                    </Text>
                    {detail.rsiTrend === 'up' && (
                      <Ionicons name="arrow-up" size={18} color={colors.positive} style={styles.rsiArrow} />
                    )}
                    {detail.rsiTrend === 'down' && (
                      <Ionicons name="arrow-down" size={18} color={colors.negative} style={styles.rsiArrow} />
                    )}
                  </View>
                </View>
                <View style={[styles.rsiBadge, { backgroundColor: getRsiColor() + '18' }]}>
                  <Text style={[styles.rsiBadgeText, { color: getRsiColor() }]}>{getRsiLabel()}</Text>
                </View>
              </View>
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

          {/* Momentum + Volume row */}
          {(detail.momentumScore != null || detail.relativeVolume != null) && (
            <View style={styles.indicatorRow}>
              {detail.momentumScore != null && (
                <View style={styles.maCard}>
                  <Text style={styles.indicatorCardLabel}>MOMENTUM</Text>
                  <Text style={[styles.indicatorCardValue, { color: getMomentumColor(detail.momentumScore) }]}>
                    {detail.momentumScore}
                    <Text style={styles.indicatorCardUnit}>/100</Text>
                  </Text>
                  <View style={[styles.trendPill, { backgroundColor: getMomentumColor(detail.momentumScore) + '20' }]}>
                    <Text style={[styles.trendPillText, { color: getMomentumColor(detail.momentumScore) }]}>
                      {getMomentumLabel(detail.momentumScore)}
                    </Text>
                  </View>
                </View>
              )}
              {detail.relativeVolume != null && (
                <View style={styles.maCard}>
                  <Text style={styles.indicatorCardLabel}>REL. VOLUME</Text>
                  <Text style={styles.indicatorCardValue}>
                    {detail.relativeVolume.toFixed(1)}
                    <Text style={styles.indicatorCardUnit}>x avg</Text>
                  </Text>
                  <View style={[styles.trendPill, {
                    backgroundColor: (detail.relativeVolume >= 1.5 ? colors.positive : colors.textMuted) + '20',
                  }]}>
                    <Text style={[styles.trendPillText, {
                      color: detail.relativeVolume >= 1.5 ? colors.positive : colors.textSecondary,
                    }]}>
                      {detail.relativeVolume >= 2 ? 'HIGH VOL' : detail.relativeVolume >= 1.5 ? 'ELEVATED' : 'NORMAL'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Support & Resistance */}
          {detail.supportLevel != null && detail.resistanceLevel != null && (
            <View style={styles.srCard}>
              <View style={styles.srHeader}>
                <Text style={styles.indicatorCardLabel}>SUPPORT / RESISTANCE</Text>
                {detail.srSignal && (
                  <View style={[styles.trendPill, { backgroundColor: getSrLabel().color + '18' }]}>
                    <Ionicons name={getSrLabel().icon} size={11} color={getSrLabel().color} />
                    <Text style={[styles.trendPillText, { color: getSrLabel().color }]}>
                      {getSrLabel().label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.srRow}>
                <View style={styles.srItem}>
                  <Text style={[styles.srItemLabel, { color: colors.positive }]}>SUPPORT</Text>
                  <Text style={[styles.srItemValue, { color: colors.positive }]}>
                    ${detail.supportLevel.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.srDivider} />
                <View style={styles.srItem}>
                  <Text style={[styles.srItemLabel, { color: colors.negative }]}>RESISTANCE</Text>
                  <Text style={[styles.srItemValue, { color: colors.negative }]}>
                    ${detail.resistanceLevel.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 52-week range */}
          {detail.week52High != null && detail.week52Low != null && (
            <View style={styles.week52Card}>
              <Text style={styles.indicatorCardLabel}>52-WEEK RANGE</Text>
              <View style={styles.week52Row}>
                <Text style={[styles.week52Val, { color: colors.negative }]}>
                  ${detail.week52Low.toFixed(2)}
                </Text>
                <Text style={styles.week52Current}>${detail.currentPrice.toFixed(2)}</Text>
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
                <View style={[styles.week52Dot, { left: `${Math.min(Math.max(pricePosition, 2), 98)}%` as unknown as number }]} />
              </View>
              <View style={styles.week52SubRow}>
                <Text style={styles.week52Sub}>LOW</Text>
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

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 8 },
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

    heroSection: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    companyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    companyLogo: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    companyLogoText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    symbolText: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    exchangeBadge: {
      backgroundColor: colors.surface,
      borderRadius: Radius.sm,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    exchangeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
    companyName: { fontSize: 13, color: colors.textSecondary, maxWidth: 260 },
    price: { fontSize: 40, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    changeRow: { marginTop: 6 },
    changePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
    },
    change: { fontSize: 14, fontWeight: '700' },

    chartSection: { paddingHorizontal: 20, marginBottom: 24 },
    chartWrapper: {
      position: 'relative',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginBottom: 12,
    },
    chartPlaceholder: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    noChartText: { color: colors.textMuted, fontSize: 13 },
    chartPriceLabel: {
      position: 'absolute',
      right: 8,
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chartPriceLabelTop: { top: 8 },
    chartPriceLabelBottom: { bottom: 8 },

    ranges: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
    },
    rangeBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: Radius.full,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rangeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

    indicatorsSection: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },

    indicatorRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    maCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 14,
    },
    indicatorCardLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.5 },
    indicatorCardValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    indicatorCardUnit: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    trendPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    trendPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

    rsiCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 16,
      marginBottom: 12,
    },
    rsiRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    rsiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
    rsiBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
    rsiValueRow: { flexDirection: 'row', alignItems: 'center' },
    rsiValue: { fontSize: 30, fontWeight: '800' },
    rsiArrow: { marginLeft: 4 },
    rsiBar: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 6,
    },
    rsiBarBg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.border, borderRadius: 4 },
    rsiBarFill: { height: 8, borderRadius: 4 },
    rsiMark: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: colors.background,
    },
    rsiBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    rsiBarLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

    srCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 16,
      marginBottom: 12,
    },
    srHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    srRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    srItem: { flex: 1, alignItems: 'center' },
    srItemLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
    srItemValue: { fontSize: 20, fontWeight: '800' },
    srDivider: { width: 1, height: 36, backgroundColor: colors.border },

    week52Card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 16,
    },
    week52Row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    week52Val: { fontSize: 14, fontWeight: '700' },
    week52BarBg: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'visible',
      marginBottom: 8,
      position: 'relative',
    },
    week52BarFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
    week52Dot: {
      position: 'absolute',
      top: -3,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primary,
      marginLeft: -7,
      borderWidth: 2,
      borderColor: colors.background,
    },
    week52SubRow: { flexDirection: 'row', justifyContent: 'space-between' },
    week52Sub: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
    week52Current: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

    ctaSection: { paddingHorizontal: 20, paddingBottom: 40 },
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
