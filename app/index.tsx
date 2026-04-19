import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { Colors, Radius, Shadow } from '@/constants/theme';

const { width } = Dimensions.get('window');

const MOCK_STOCKS = [
  { symbol: 'AAPL', change: '+108.68%', positive: true },
  { symbol: 'TSLA', change: '-54.49%', positive: false },
  { symbol: 'NVDA', change: '+62.34%', positive: true },
  { symbol: 'MSFT', change: '+198.39%', positive: true },
];

export default function SplashScreen() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoRow}>
        <Ionicons name="bar-chart" size={22} color={Colors.textPrimary} />
        <Text style={styles.logoText}>
          Stockve<Text style={styles.logoHighlight}>st</Text>
        </Text>
      </View>

      {/* Decorative stock cards */}
      <View style={styles.cardsContainer}>
        {/* Lime chart background accent */}
        <View style={styles.chartAccent} />

        {/* Left column — offset down slightly */}
        <View style={styles.column}>
          <StockCard stock={MOCK_STOCKS[0]} />
          <View style={{ height: 16 }} />
          <StockCard stock={MOCK_STOCKS[2]} />
        </View>

        {/* Right column — offset up slightly */}
        <View style={[styles.column, { marginTop: -32 }]}>
          <StockCard stock={MOCK_STOCKS[1]} />
          <View style={{ height: 16 }} />
          <StockCard stock={MOCK_STOCKS[3]} />
        </View>
      </View>

      {/* Bottom content */}
      <View style={styles.bottomSection}>
        <Text style={styles.heading}>Easy Stock Investment{'\n'}For Beginners</Text>
        <Text style={styles.subtitle}>
          Screening feature to filter stocks to maximize profits.
        </Text>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Let's Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StockCard({ stock }: { stock: (typeof MOCK_STOCKS)[number] }) {
  return (
    <View style={styles.card}>
      {/* Colored circle avatar */}
      <View style={[styles.cardIcon, { backgroundColor: stock.positive ? '#E8FDD0' : '#FDE8E8' }]}>
        <Ionicons
          name={stock.positive ? 'trending-up' : 'trending-down'}
          size={16}
          color={stock.positive ? Colors.positive : Colors.negative}
        />
      </View>
      <Text style={styles.cardSymbol}>{stock.symbol}</Text>
      <Text style={[styles.cardChange, { color: stock.positive ? Colors.positive : Colors.negative }]}>
        {stock.change}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 64,
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 40,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  logoHighlight: {
    backgroundColor: Colors.primary,
    color: Colors.onPrimary,
    borderRadius: 4,
    overflow: 'hidden',
  },

  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    marginBottom: 16,
    height: 260,
    alignItems: 'center',
  },
  column: {
    flex: 1,
  },
  chartAccent: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: width * 0.55,
    height: 160,
    backgroundColor: Colors.primary,
    opacity: 0.12,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 20,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSymbol: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardChange: {
    fontSize: 12,
    fontWeight: '600',
  },

  bottomSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    justifyContent: 'flex-end',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },

  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.onPrimary,
  },
});
