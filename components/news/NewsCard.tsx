import { HOME } from '@/components/home/home-tokens';
import type { NewsArticle } from '@/lib/api';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ─── Timestamp formatting ─────────────────────────────────────────────────────

function formatNewsTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return 'just now';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  // Over 24 hours → short date "Jan 3"
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── Source dot color ─────────────────────────────────────────────────────────

const SOURCE_COLORS = [
  '#4a7eff', '#26d98e', '#ff9f43', '#ff6b6b', '#a29bfe',
  '#55efc4', '#fd79a8', '#74b9ff', '#ffeaa7', '#00cec9',
];

function sourceColor(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) & 0xffff;
  }
  return SOURCE_COLORS[hash % SOURCE_COLORS.length];
}

const SOURCE_ICON_TINTS = [
  '#1a2a3a', '#1a3a2a', '#3a2a1a', '#2a1a3a', '#3a1a1a', '#1a3a3a',
];

function iconTint(source: string): string {
  return SOURCE_ICON_TINTS[source.charCodeAt(0) % SOURCE_ICON_TINTS.length];
}

// ─── Impact badge ─────────────────────────────────────────────────────────────

const IMPACT = {
  high: { bg: '#2d1a0e', text: '#e8652a', label: 'High impact' },
  medium: { bg: '#2a2210', text: '#d4a017', label: 'Medium impact' },
} as const;

// ─── Ticker chip ──────────────────────────────────────────────────────────────

function TickerChip({
  symbol,
  change,
}: {
  symbol: string;
  change?: number | null;
}) {
  let bg = '#1e1e1e';
  let textColor = '#888888';
  let label = symbol;

  if (change != null) {
    const sign = change >= 0 ? '+' : '';
    label = `${symbol} ${sign}${change.toFixed(1)}%`;
    if (change > 0) {
      bg = '#0d2a1a';
      textColor = '#26d98e';
    } else if (change < 0) {
      bg = '#2a0d0d';
      textColor = '#ff6b6b';
    }
  }

  return (
    <View style={[chipStyles.chip, { backgroundColor: bg }]}>
      <Text style={[chipStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 6,
    marginTop: 6,
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});

// ─── NewsCard ─────────────────────────────────────────────────────────────────

interface Props {
  article: NewsArticle;
}

export default function NewsCard({ article }: Props) {
  const initial = (article.source || '?').slice(0, 1).toUpperCase();
  const dotColor = sourceColor(article.source);
  const tint = iconTint(article.source);
  const timeLabel = formatNewsTime(article.publishedAt);
  const impact = article.importance === 2 ? IMPACT.high : article.importance === 1 ? IMPACT.medium : null;

  const hasTickers = article.tickers.length > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => {
        if (article.url) WebBrowser.openBrowserAsync(article.url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={`${article.source}: ${article.headline}`}
    >
      {/* Top row: source + time + icon */}
      <View style={styles.topRow}>
        <View style={styles.metaBlock}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.source} numberOfLines={1}>
            {article.source}
          </Text>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <View style={[styles.icon, { backgroundColor: tint }]}>
          <Text style={styles.iconText}>{initial}</Text>
        </View>
      </View>

      {/* Impact badge */}
      {impact && (
        <View style={[styles.badge, { backgroundColor: impact.bg }]}>
          <Text style={[styles.badgeText, { color: impact.text }]}>{impact.label}</Text>
        </View>
      )}

      {/* Headline */}
      <Text style={styles.headline} numberOfLines={2}>
        {article.headline}
      </Text>

      {/* Ticker chips */}
      {hasTickers ? (
        <View style={styles.chips}>
          {article.tickers.slice(0, 4).map((ticker) => (
            <TickerChip
              key={ticker}
              symbol={ticker}
              change={article.tickerChanges?.[ticker] ?? null}
            />
          ))}
        </View>
      ) : (
        <View style={styles.chips}>
          <TickerChip symbol="Macro" change={null} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: HOME.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'nowrap',
    marginRight: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  source: {
    color: HOME.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 120,
  },
  separator: {
    color: HOME.textMuted,
    fontSize: 11,
    marginHorizontal: 4,
  },
  time: {
    color: HOME.textMuted,
    fontSize: 11,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    color: HOME.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headline: {
    color: HOME.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
