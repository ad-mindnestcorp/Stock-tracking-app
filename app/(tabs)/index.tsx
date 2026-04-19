import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHomeData } from '@/hooks/use-home-data';
import { type StockQuote, type HomeData } from '@/lib/api';
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

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/stock/${searchQuery.trim().toUpperCase()}`);
      setSearchQuery('');
    }
  };

  const currentList: StockQuote[] = homeData?.[activeTab] ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
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
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search symbol (e.g. AAPL)"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="characters"
            returnKeyType="search"
          />
        </View>

        {isError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load market data'}
            </Text>
            <TouchableOpacity onPress={() => refetch()}>
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
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.listWrap}>
              {currentList.map((item) => (
                <StockListItem key={item.symbol} item={item} />
              ))}
            </View>
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
  });
}
