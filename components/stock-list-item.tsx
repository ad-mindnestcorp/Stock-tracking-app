import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/theme-context';
import { Radius, Shadow } from '@/constants/theme';
import type { StockQuote } from '@/lib/api';

interface StockListItemProps {
  item: StockQuote | { symbol: string; company_name?: string | null; quote: StockQuote | null };
  showCard?: boolean;
}

function getQuote(item: StockListItemProps['item']): StockQuote | null {
  if ('quote' in item) return item.quote;
  return item as StockQuote;
}

function getSymbol(item: StockListItemProps['item']): string {
  return 'symbol' in item ? item.symbol : (item as StockQuote).symbol;
}

function getCompanyName(item: StockListItemProps['item']): string {
  if ('company_name' in item && item.company_name) return item.company_name;
  if ('profile' in (item as StockQuote) && (item as StockQuote).profile?.name) {
    return (item as StockQuote).profile!.name;
  }
  return getSymbol(item);
}

export default function StockListItem({ item, showCard = false }: StockListItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const symbol = getSymbol(item);
  const quote = getQuote(item);
  const companyName = getCompanyName(item);

  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;

  return (
    <TouchableOpacity
      style={[styles.row, showCard && styles.card]}
      onPress={() => router.push(`/stock/${symbol}`)}
      activeOpacity={0.7}
    >
      <View style={styles.logo}>
        <Text style={styles.logoText}>{symbol.slice(0, 2)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.name} numberOfLines={1}>{companyName}</Text>
      </View>

      <View style={styles.price}>
        {quote ? (
          <>
            <Text style={styles.priceText}>${quote.currentPrice.toFixed(2)}</Text>
            <Text style={[styles.change, { color: changeColor }]}>
              {isPositive ? '+' : ''}{(quote.changePercent ?? 0).toFixed(2)}%
            </Text>
          </>
        ) : (
          <Text style={styles.noData}>—</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: Radius.md,
      paddingHorizontal: 16,
      marginBottom: 10,
      borderBottomWidth: 0,
      ...Shadow.card,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    logoText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    info: { flex: 1 },
    symbol: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    name: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    price: { alignItems: 'flex-end' },
    priceText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    change: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    noData: { fontSize: 14, color: colors.textMuted },
  });
}
