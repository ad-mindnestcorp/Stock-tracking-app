import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatNumberCompact, formatPercent } from '@/lib/formatters';
import { HOME, getChangeColor } from './home-tokens';

interface MoverRowProps {
  rank: number;
  ticker: string;
  name?: string;
  price: number | null | undefined;
  changePercent: number | null | undefined;
  logoUrl?: string;
}

const FALLBACK_TINTS = [
  '#1e3a1e',
  '#3a1e1e',
  '#1e2a3a',
  '#2a2a1e',
  '#2a1a2a',
  '#1e2a2a',
  '#3a2a1a',
  '#1e1e3a',
];

export default function MoverRow({
  rank,
  ticker,
  name,
  price,
  changePercent,
  logoUrl,
}: MoverRowProps) {
  const color = getChangeColor(changePercent);
  const initial = ticker.slice(0, 2).toUpperCase();
  const fallbackBg = FALLBACK_TINTS[ticker.charCodeAt(0) % FALLBACK_TINTS.length];

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push(`/stock/${ticker}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${ticker} ${name ?? ''} ${formatPercent(changePercent)}`}
    >
      <Text style={styles.rank}>{rank}</Text>
      <View style={[styles.icon, { backgroundColor: fallbackBg }]}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.iconImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={styles.iconText}>{initial}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.ticker}>{ticker}</Text>
        {!!name && (
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        )}
      </View>
      <Text style={styles.price}>{formatNumberCompact(price)}</Text>
      <Text style={[styles.change, { color }]}>{formatPercent(changePercent)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.separator,
  },
  rank: { color: HOME.textMuted, fontSize: 11, width: 16 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%' },
  iconText: { color: HOME.textPrimary, fontWeight: '800', fontSize: 11 },
  info: { flex: 1, paddingRight: 8 },
  ticker: { color: HOME.textPrimary, fontWeight: '700', fontSize: 13 },
  name: { color: HOME.textMuted, fontSize: 10, marginTop: 1 },
  price: {
    color: '#dddddd',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 64,
    textAlign: 'right',
  },
  change: { fontSize: 12, fontWeight: '700', minWidth: 56, textAlign: 'right' },
});
