import { View, Text, StyleSheet } from 'react-native';
import { HOME } from '@/components/home/home-tokens';
import type { AIStockSummary } from '@/lib/ai-types';

interface Props {
  summary: AIStockSummary;
}

export function StockSummaryCard({ summary }: Props) {
  const isPositive = summary.changePercent >= 0;
  const changeColor = isPositive ? HOME.positive : HOME.negative;
  const changeSign = isPositive ? '+' : '';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {/* Logo placeholder */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>{summary.ticker.slice(0, 4)}</Text>
        </View>

        {/* Ticker + company */}
        <View style={styles.info}>
          <View style={styles.tickerRow}>
            <Text style={styles.ticker}>{summary.ticker}</Text>
            {summary.exchange ? (
              <View style={styles.exchangeBadge}>
                <Text style={styles.exchangeText}>{summary.exchange}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.company} numberOfLines={1}>
            {summary.companyName}
          </Text>
        </View>

        {/* Price + change */}
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{summary.price.toFixed(2)}</Text>
          <Text style={[styles.change, { color: changeColor }]}>
            {changeSign}{summary.change.toFixed(2)} ({changeSign}{summary.changePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: HOME.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: HOME.border,
    flexShrink: 0,
  },
  logoText: {
    fontSize: 10,
    fontWeight: '700',
    color: HOME.textPrimary,
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticker: {
    fontSize: 17,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  exchangeBadge: {
    backgroundColor: HOME.cardElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: HOME.border,
  },
  exchangeText: {
    fontSize: 10,
    fontWeight: '600',
    color: HOME.textSecondary,
    letterSpacing: 0.3,
  },
  company: {
    fontSize: 12,
    color: HOME.textSecondary,
  },
  priceBlock: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  change: {
    fontSize: 12,
    fontWeight: '600',
  },
});
