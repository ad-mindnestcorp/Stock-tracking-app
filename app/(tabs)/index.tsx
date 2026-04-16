import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { marketApi, type StockQuote, type HomeData } from '@/lib/api';
import { Colors, Radius } from '@/constants/theme';
import StockListItem from '@/components/stock-list-item';

type Tab = 'trending' | 'topGainers' | 'topLosers' | 'mostActive';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'topGainers', label: 'Top Gainer' },
  { key: 'topLosers', label: 'Top Loser' },
  { key: 'mostActive', label: 'Most Active' },
];

export default function HomeScreen() {
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await marketApi.getHome();
      setHomeData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/stock/${searchQuery.trim().toUpperCase()}`);
      setSearchQuery('');
    }
  };

  const currentList: StockQuote[] = homeData?.[activeTab] ?? [];

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading market data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="bar-chart" size={22} color={Colors.dark} />
            <Text style={styles.logoText}>
              Stockv<Text style={styles.logoAccent}>e</Text>st
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search symbol (e.g. AAPL)"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="characters"
            returnKeyType="search"
          />
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Market index summary */}
        {homeData && <MarketSummary data={homeData} />}

        {/* Tabs */}
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

        {/* Stock list */}
        <View style={styles.listWrap}>
          {currentList.map((item) => (
            <StockListItem key={item.symbol} item={item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketSummary({ data }: { data: HomeData }) {
  const gainers = data.topGainers.filter((s) => s.changePercent > 0).length;
  const losers = data.topLosers.filter((s) => s.changePercent < 0).length;
  const avgChange =
    data.trending.reduce((sum, s) => sum + (s.changePercent ?? 0), 0) / (data.trending.length || 1);
  const isUp = avgChange >= 0;

  return (
    <View style={[styles.summaryCard, { borderColor: isUp ? Colors.positive : Colors.negative }]}>
      <Text style={styles.summaryLabel}>Market Overview</Text>
      <Text style={[styles.summaryChange, { color: isUp ? Colors.positive : Colors.negative }]}>
        {isUp ? '▲' : '▼'} {Math.abs(avgChange).toFixed(2)}% avg
      </Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemValue}>{gainers}</Text>
          <Text style={[styles.summaryItemLabel, { color: Colors.positive }]}>Advancing</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryItemValue}>{losers}</Text>
          <Text style={[styles.summaryItemLabel, { color: Colors.negative }]}>Declining</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { fontSize: 20, fontWeight: '700', color: Colors.dark },
  logoAccent: {
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    borderRadius: 3,
    paddingHorizontal: 1,
    color: Colors.dark,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },

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
  errorText: { color: Colors.negative, fontSize: 13, flex: 1 },
  retryText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.dark,
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
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.dark },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  listWrap: { paddingHorizontal: 20, paddingBottom: 20 },
});
