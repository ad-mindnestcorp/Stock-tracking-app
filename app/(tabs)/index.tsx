import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHomeData } from '@/hooks/use-home-data';
import { useTrending } from '@/hooks/use-trending';
import { type StockQuote, type HomeData, type TrendingStock } from '@/lib/api';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';
import StockListItem from '@/components/stock-list-item';
import { SkeletonHomeScreen } from '@/components/skeleton';

type Tab = 'trending' | 'topGainers' | 'topLosers' | 'mostActive';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'topGainers', label: 'Top Gainer' },
  { key: 'topLosers', label: 'Top Loser' },
  { key: 'mostActive', label: 'Most Active' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: homeData, isLoading, isError, error, refetch, isRefetching } = useHomeData();
  const {
    data: trendingData,
    isLoading: isTrendingLoading,
    isError: isTrendingError,
    refetch: refetchTrending,
  } = useTrending();

  const handleRefresh = () => {
    refetch();
    refetchTrending();
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/stock/${searchQuery.trim().toUpperCase()}`);
      setSearchQuery('');
    }
  };

  const currentList: StockQuote[] = activeTab !== 'trending' ? (homeData?.[activeTab] ?? []) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="bar-chart" size={22} color={colors.textPrimary} />
            <Text style={styles.logoText}>
              Stockv<Text style={styles.logoAccent}>e</Text>st
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap} accessibilityRole="search">
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
            accessibilityElementsHidden
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search symbol (e.g. AAPL)"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="characters"
            returnKeyType="search"
            accessibilityLabel="Stock symbol search"
            accessibilityHint="Type a stock symbol and press search"
          />
        </View>

        {isError && (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load market data'}
            </Text>
            <TouchableOpacity onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading market data">
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <SkeletonHomeScreen />
        ) : (
          <>
            {homeData && <MarketSummary data={homeData} colors={colors} styles={styles} />}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScroll}
              contentContainerStyle={styles.tabs}
            >
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: activeTab === tab.key }}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {activeTab === 'trending' ? (
              <View style={styles.listWrap}>
                {isTrendingLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
                ) : isTrendingError ? (
                  <View style={styles.errorCard} accessibilityRole="alert">
                    <Text style={styles.errorText}>Failed to load Reddit trending stocks</Text>
                    <TouchableOpacity onPress={() => refetchTrending()} accessibilityRole="button">
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : trendingData && trendingData.length > 0 ? (
                  <>
                    {trendingData.map((item) => (
                      <RedditTrendingItem key={item.ticker} item={item} colors={colors} styles={styles} />
                    ))}
                    <Text style={styles.lastUpdatedText}>
                      Updated {new Date(trendingData[0].last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No trending data yet — check back soon.</Text>
                )}
              </View>
            ) : (
              <View style={styles.listWrap}>
                {currentList.map((item) => (
                  <StockListItem key={item.symbol} item={item} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketSummary({
  data,
  colors,
  styles,
}: {
  data: HomeData;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const gainers = data.topGainers.filter((s) => s.changePercent > 0).length;
  const losers = data.topLosers.filter((s) => s.changePercent < 0).length;
  const avgChange =
    data.trending.reduce((sum, s) => sum + (s.changePercent ?? 0), 0) / (data.trending.length || 1);
  const isUp = avgChange >= 0;

  return (
    <View style={[styles.summaryCard, { borderColor: isUp ? colors.positive : colors.negative }]}>
      <Text style={styles.summaryLabel}>Market Overview</Text>
      <Text style={[styles.summaryChange, { color: isUp ? colors.positive : colors.negative }]}>
        {isUp ? '▲' : '▼'} {Math.abs(avgChange).toFixed(2)}% avg
      </Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemValue}>{gainers}</Text>
          <Text style={[styles.summaryItemLabel, { color: colors.positive }]}>Advancing</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemValue}>{losers}</Text>
          <Text style={[styles.summaryItemLabel, { color: colors.negative }]}>Declining</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemValue}>{data.trending.length}</Text>
          <Text style={styles.summaryItemLabel}>Tracked</Text>
        </View>
      </View>
    </View>
  );
}

function RedditTrendingItem({
  item,
  colors,
  styles,
}: {
  item: TrendingStock;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const isPositive = item.sentiment > 0;
  const isNegative = item.sentiment < 0;
  const sentimentLabel = isPositive ? 'Bullish' : isNegative ? 'Bearish' : 'Neutral';
  const sentimentColor = isPositive ? colors.positive : isNegative ? colors.negative : colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.trendingItem}
      onPress={() => router.push(`/stock/${item.ticker}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.ticker}, rank ${item.rank}, score ${item.score}, ${sentimentLabel}`}
    >
      <View style={[styles.rankBadge, { backgroundColor: item.rank <= 3 ? colors.primary : colors.surface }]}>
        <Text style={[styles.rankText, { color: item.rank <= 3 ? colors.onPrimary : colors.textSecondary }]}>
          #{item.rank}
        </Text>
      </View>
      <View style={styles.trendingInfo}>
        <View style={styles.trendingTopRow}>
          <Text style={styles.trendingTicker}>{item.ticker}</Text>
          <Text style={[styles.trendArrow, { color: item.trend === 'up' ? colors.positive : colors.negative }]}>
            {item.trend === 'up' ? '▲' : '▼'}
          </Text>
        </View>
        <View style={styles.trendingBottomRow}>
          <Text style={styles.trendingMentions}>{item.mentions} mentions · {item.score.toFixed(1)} score</Text>
          <View style={[styles.sentimentChip, { backgroundColor: sentimentColor + '22' }]}>
            <Text style={[styles.sentimentLabel, { color: sentimentColor }]}>{sentimentLabel}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    logo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logoText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    logoAccent: {
      backgroundColor: colors.primary,
      overflow: 'hidden',
      borderRadius: 3,
      paddingHorizontal: 1,
      color: colors.onPrimary,
    },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: Radius.full,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 16,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },

    errorCard: {
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: '#FEF2F2',
      borderRadius: Radius.md,
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { color: colors.negative, fontSize: 13, flex: 1 },
    retryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

    summaryCard: {
      marginHorizontal: 20,
      marginBottom: 16,
      backgroundColor: colors.dark,
      borderRadius: Radius.lg,
      padding: 20,
      borderLeftWidth: 4,
    },
    summaryLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
    summaryChange: { fontSize: 28, fontWeight: '800', marginBottom: 16 },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryItemValue: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    summaryItemLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    summaryDivider: { width: 1, height: 32, backgroundColor: '#374151' },

    tabsScroll: { marginBottom: 4 },
    tabs: { paddingHorizontal: 20, gap: 8 },
    tab: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
    },
    tabActive: { backgroundColor: colors.dark },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },

    listWrap: { paddingHorizontal: 20, paddingBottom: 20 },

    trendingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
      gap: 12,
    },
    rankBadge: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { fontSize: 12, fontWeight: '700' },
    trendingInfo: { flex: 1 },
    trendingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    trendingTicker: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    trendArrow: { fontSize: 13, fontWeight: '700' },
    trendingBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
    trendingMentions: { fontSize: 12, color: colors.textMuted },
    sentimentChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: Radius.full,
    },
    sentimentLabel: { fontSize: 11, fontWeight: '600' },

    lastUpdatedText: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 8,
      marginBottom: 4,
    },

    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: 32,
      fontSize: 14,
    },
  });
}
