import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StepProgress } from '@/components/onboarding/step-progress';
import { useOnboarding } from '@/context/onboarding-context';
import { track } from '@/lib/analytics';

const MIN_STOCKS = 5;

const CURATED_STOCKS: Array<{ symbol: string; name: string; sector: string }> = [
  { symbol: 'AAPL', name: 'Apple', sector: 'Tech' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech' },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Tech' },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Tech' },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Tech' },
  { symbol: 'META', name: 'Meta', sector: 'Tech' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'EV/Auto' },
  { symbol: 'AMD', name: 'AMD', sector: 'Semiconductors' },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Streaming' },
  { symbol: 'CRM', name: 'Salesforce', sector: 'SaaS' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance' },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Finance' },
  { symbol: 'V', name: 'Visa', sector: 'Payments' },
  { symbol: 'MA', name: 'Mastercard', sector: 'Payments' },
  { symbol: 'PYPL', name: 'PayPal', sector: 'Payments' },
  { symbol: 'COIN', name: 'Coinbase', sector: 'Crypto' },
  { symbol: 'MSTR', name: 'MicroStrategy', sector: 'Crypto' },
  { symbol: 'PLTR', name: 'Palantir', sector: 'AI/Data' },
  { symbol: 'SNOW', name: 'Snowflake', sector: 'Cloud' },
  { symbol: 'SHOP', name: 'Shopify', sector: 'E-Commerce' },
  { symbol: 'UBER', name: 'Uber', sector: 'Mobility' },
  { symbol: 'ABNB', name: 'Airbnb', sector: 'Travel' },
  { symbol: 'SPOT', name: 'Spotify', sector: 'Audio' },
  { symbol: 'RBLX', name: 'Roblox', sector: 'Gaming' },
  { symbol: 'HOOD', name: 'Robinhood', sector: 'Finance' },
  { symbol: 'SQ', name: 'Block (Square)', sector: 'Finance' },
  { symbol: 'DIS', name: 'Disney', sector: 'Media' },
  { symbol: 'NKE', name: 'Nike', sector: 'Consumer' },
  { symbol: 'SBUX', name: 'Starbucks', sector: 'Consumer' },
  { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'ETF' },
];

export default function StockSelectionScreen() {
  const { setSelectedStocks } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return CURATED_STOCKS;
    const q = search.toUpperCase();
    return CURATED_STOCKS.filter(
      (s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q)
    );
  }, [search]);

  const toggle = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selected.size < MIN_STOCKS) return;
    const stocks = CURATED_STOCKS.filter((s) => selected.has(s.symbol)).map((s) => ({
      symbol: s.symbol,
      name: s.name,
    }));
    await setSelectedStocks(stocks);
    track('onboarding_step_completed', { step: 'stock_selection', count: selected.size });
    router.push('/(onboarding)/personalizing');
  };

  const remaining = Math.max(0, MIN_STOCKS - selected.size);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <StepProgress totalSteps={4} currentStep={2} />
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.headline}>Which stocks{'\n'}do you follow?</Text>
        <Text style={styles.subtitle}>
          {remaining > 0
            ? `Pick at least ${MIN_STOCKS} stocks. Choose ${remaining} more.`
            : `${selected.size} selected — great! Add more if you'd like.`}
        </Text>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#888888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stocks…"
            placeholderTextColor="#888888"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#888888" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((stock) => {
            const isSelected = selected.has(stock.symbol);
            return (
              <TouchableOpacity
                key={stock.symbol}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => toggle(stock.symbol)}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                  <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                    {stock.symbol.slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.symbol}>{stock.symbol}</Text>
                  <Text style={styles.name}>{stock.name}</Text>
                </View>
                <View style={styles.sectorBadge}>
                  <Text style={styles.sectorText}>{stock.sector}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color="#CCFF00" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.continueBtn, selected.size < MIN_STOCKS && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={selected.size < MIN_STOCKS}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {selected.size < MIN_STOCKS
              ? `Select ${remaining} more to continue`
              : `Continue with ${selected.size} stocks`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 38,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 21,
    marginBottom: 16,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    paddingVertical: 0,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  rowSelected: {
    borderColor: '#CCFF00',
    backgroundColor: '#1a1f0a',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: { backgroundColor: '#CCFF0030' },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888888',
  },
  avatarTextSelected: { color: '#CCFF00' },
  rowInfo: { flex: 1 },
  symbol: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  name: { fontSize: 12, color: '#888888', marginTop: 2 },
  sectorBadge: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectorText: { fontSize: 10, color: '#888888', fontWeight: '600' },
  continueBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  continueBtnDisabled: { opacity: 0.35 },
  continueBtnText: { fontSize: 15, fontWeight: '800', color: '#0a0a0a' },
});
