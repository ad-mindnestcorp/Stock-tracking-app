import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOME } from '@/components/home/home-tokens';
import type { SectionKey } from '@/lib/ai-types';
import { SECTION_META } from '@/lib/ai-types';

type Verdict = string;

interface Props {
  sectionKey: SectionKey;
  verdict: Verdict;
  insightCount?: number;
  insightLabel?: string;
  onPress: () => void;
}

const VERDICT_COLORS: Record<string, { bg: string; text: string }> = {
  Strong: { bg: '#0d2d1a', text: HOME.positive },
  Positive: { bg: '#0d2d1a', text: HOME.positive },
  Low: { bg: '#0d2d1a', text: HOME.positive },
  Bullish: { bg: '#0d2d1a', text: HOME.positive },
  Moderate: { bg: '#2d2200', text: '#f5a623' },
  Neutral: { bg: '#1a1a1a', text: HOME.textSecondary },
  Elevated: { bg: '#2d1400', text: '#ff8c42' },
  Weak: { bg: '#2d0d0d', text: HOME.negative },
  Negative: { bg: '#2d0d0d', text: HOME.negative },
  High: { bg: '#2d0d0d', text: HOME.negative },
  Bearish: { bg: '#2d0d0d', text: HOME.negative },
};

function getVerdictStyle(verdict: string) {
  return VERDICT_COLORS[verdict] ?? { bg: HOME.cardElevated, text: HOME.textSecondary };
}

const SECTION_ICON_COLORS: Record<SectionKey, string> = {
  research_foundation: '#7b6ef6',
  valuation_financials: '#f5a623',
  risk_red_teaming: '#ff8c42',
  technicals: HOME.positive,
};

export function ResearchSectionCard({ sectionKey, verdict, insightCount, insightLabel, onPress }: Props) {
  const meta = SECTION_META[sectionKey];
  const iconColor = SECTION_ICON_COLORS[sectionKey];
  const verdictStyle = getVerdictStyle(verdict);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}: ${verdict}`}
    >
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '22' }]}>
          <Ionicons name={meta.icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.labelBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.number}>{meta.number}</Text>
            <Text style={styles.title}>{meta.title}</Text>
          </View>
          <Text style={styles.description}>{meta.description}</Text>
          {insightCount != null && (
            <Text style={styles.insights}>
              {insightCount} {insightLabel ?? 'key insights'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        <View style={[styles.verdictBadge, { backgroundColor: verdictStyle.bg }]}>
          <Text style={[styles.verdictText, { color: verdictStyle.text }]}>{verdict}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={HOME.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelBlock: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  number: {
    fontSize: 12,
    fontWeight: '700',
    color: HOME.textMuted,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  description: {
    fontSize: 12,
    color: HOME.textSecondary,
    lineHeight: 17,
  },
  insights: {
    fontSize: 12,
    color: HOME.accent,
    marginTop: 4,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  verdictBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
