import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useMarketNews } from '@/hooks/use-market-news';
import { formatTimeAgo } from '@/lib/formatters';
import { HOME } from './home-tokens';
import { SectionError, SectionEmpty, Skeleton } from './section-states';
import type { MarketNewsItem } from '@/lib/finnhub-direct';

const SOURCE_TINTS = [
  '#1a2a3a',
  '#3a1a1a',
  '#1a3a1a',
  '#3a2a1a',
  '#2a1a3a',
  '#1a3a3a',
];

export default function NewsList({ limit = 10 }: { limit?: number }) {
  const { data, isLoading, isError, error, refetch } = useMarketNews();

  if (isError) return <SectionError message={error?.message} onRetry={() => refetch()} />;

  if (isLoading || !data) {
    return (
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton width={38} height={38} radius={8} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Skeleton width="30%" height={9} />
              <View style={{ height: 4 }} />
              <Skeleton width="100%" height={11} />
              <View style={{ height: 2 }} />
              <Skeleton width="70%" height={11} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  const items = data.slice(0, limit);
  if (items.length === 0) return <SectionEmpty message="No news available" />;

  return (
    <View>
      {items.map((item) => (
        <NewsRow key={item.id} item={item} />
      ))}
    </View>
  );
}

function NewsRow({ item }: { item: MarketNewsItem }) {
  const initial = (item.source || '?').slice(0, 1).toUpperCase();
  const tint = SOURCE_TINTS[item.source.charCodeAt(0) % SOURCE_TINTS.length];

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => {
        if (item.url) WebBrowser.openBrowserAsync(item.url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={`${item.source}: ${item.headline}`}
    >
      <View style={[styles.icon, { backgroundColor: tint }]}>
        <Text style={styles.iconText}>{initial}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.source} numberOfLines={1}>
          {item.source.toUpperCase()}
        </Text>
        <Text style={styles.headline} numberOfLines={2}>
          {item.headline}
        </Text>
        <Text style={styles.time}>{formatTimeAgo(item.datetime)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.separator,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: HOME.textPrimary, fontSize: 14, fontWeight: '700' },
  text: { flex: 1, marginLeft: 10 },
  source: { color: HOME.textMuted, fontSize: 9, marginBottom: 2, letterSpacing: 0.5 },
  headline: {
    color: '#dddddd',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  time: { color: HOME.textMuted, fontSize: 9, marginTop: 3 },
});
