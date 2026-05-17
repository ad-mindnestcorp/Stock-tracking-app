import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOME } from '@/components/home/home-tokens';
import type { AIVerdict, OverallVerdict } from '@/lib/ai-types';

interface Props {
  verdict: AIVerdict;
}

const OVERALL_COLORS: Record<OverallVerdict, { bg: string; text: string }> = {
  'Strongly Bullish': { bg: '#0a2e1a', text: '#26d98e' },
  'Moderately Bullish': { bg: '#0d2d1a', text: '#26d98e' },
  Neutral: { bg: '#1a1a1a', text: '#888888' },
  'Moderately Bearish': { bg: '#2d1400', text: '#ff8c42' },
  'Strongly Bearish': { bg: '#2d0d0d', text: '#ff4d4d' },
};

function getOverallStyle(overall: string) {
  return (
    OVERALL_COLORS[overall as OverallVerdict] ?? {
      bg: HOME.cardElevated,
      text: HOME.textSecondary,
    }
  );
}

interface ColumnProps {
  label: string;
  icon: string;
  iconColor: string;
  items: string[];
}

function VerdictColumn({ label, icon, iconColor, items }: ColumnProps) {
  return (
    <View style={colStyles.wrap}>
      <View style={colStyles.header}>
        <Ionicons name={icon as any} size={13} color={iconColor} />
        <Text style={colStyles.label}>{label}</Text>
      </View>
      {items.map((item, i) => (
        <Text key={i} style={colStyles.item} numberOfLines={3}>
          {item}
        </Text>
      ))}
    </View>
  );
}

const colStyles = StyleSheet.create({
  wrap: { flex: 1, gap: 5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  label: { fontSize: 11, fontWeight: '700', color: HOME.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  item: { fontSize: 12, color: HOME.textSecondary, lineHeight: 16 },
});

export function AIVerdictCard({ verdict }: Props) {
  const overallStyle = getOverallStyle(verdict.overall);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={16} color={HOME.accent} />
          <Text style={styles.title}>AI Verdict</Text>
        </View>
        <View style={[styles.overallBadge, { backgroundColor: overallStyle.bg }]}>
          <Text style={[styles.overallText, { color: overallStyle.text }]}>
            {verdict.overall}
          </Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryList}>
        {(Array.isArray(verdict.summary) ? verdict.summary : [verdict.summary]).map((item, i) => (
          <View key={i} style={styles.summaryRow}>
            <View style={styles.summaryBullet} />
            <Text style={styles.summary}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* 3-column grid */}
      <View style={styles.columns}>
        <VerdictColumn
          label="Key Drivers"
          icon="trending-up-outline"
          iconColor={HOME.positive}
          items={verdict.key_drivers}
        />
        <View style={styles.colDivider} />
        <VerdictColumn
          label="Key Risks"
          icon="warning-outline"
          iconColor="#f5a623"
          items={verdict.key_risks}
        />
        <View style={styles.colDivider} />
        <VerdictColumn
          label="Catalysts"
          icon="rocket-outline"
          iconColor={HOME.accent}
          items={verdict.catalysts}
        />
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={12} color={HOME.textMuted} />
        <Text style={styles.disclaimerText}>
          AI research is for informational purposes only and not financial advice.
        </Text>
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
    marginBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  overallBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  overallText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryList: { gap: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  summaryBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: HOME.accent,
    marginTop: 8,
    flexShrink: 0,
  },
  summary: {
    fontSize: 13,
    color: HOME.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: HOME.border,
  },
  columns: {
    flexDirection: 'row',
    gap: 0,
  },
  colDivider: {
    width: 1,
    backgroundColor: HOME.border,
    marginHorizontal: 10,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingTop: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: HOME.textMuted,
    flex: 1,
    lineHeight: 15,
  },
});
