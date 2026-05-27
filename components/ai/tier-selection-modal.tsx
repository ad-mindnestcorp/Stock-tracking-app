import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOME } from '@/components/home/home-tokens';
import type { ResearchTier } from '@/lib/ai-types';
import { TIER_INFO } from '@/lib/ai-types';

interface TierSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTier: (tier: ResearchTier) => void;
}

export function TierSelectionModal({
  visible,
  onClose,
  onSelectTier,
}: TierSelectionModalProps) {
  const tiers: ResearchTier[] = ['basic', 'decent', 'indepth'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={20} color={HOME.accent} />
              <Text style={styles.headerTitle}>Select Research Depth</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={HOME.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={styles.desc}>
            Choose the level of analysis for this stock. Higher tiers include more sections and data sources.
          </Text>

          {/* Tier cards */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {tiers.map((tier) => {
              const info = TIER_INFO[tier];
              return (
                <TouchableOpacity
                  key={tier}
                  style={styles.tierCard}
                  onPress={() => {
                    onSelectTier(tier);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.tierHeader}>
                    <Text style={styles.tierTitle}>{info.title}</Text>
                    <View style={styles.tierBadge}>
                      <Text style={styles.tierBadgeText}>{info.sectionCount} sections</Text>
                    </View>
                  </View>
                  <Text style={styles.tierDesc}>{info.description}</Text>
                  <View style={styles.tierFooter}>
                    <View style={styles.tierMetric}>
                      <Ionicons name="time-outline" size={14} color={HOME.textMuted} />
                      <Text style={styles.tierMetricText}>{info.estimatedTime}</Text>
                    </View>
                    <View style={styles.tierMetric}>
                      <Ionicons name="cash-outline" size={14} color={HOME.textMuted} />
                      <Text style={styles.tierMetricText}>{info.estimatedCost}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="information-circle-outline" size={12} color={HOME.textMuted} />
            <Text style={styles.footerText}>
              All tiers use cached data when available to reduce cost and latency.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: HOME.bg,
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: HOME.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: HOME.textPrimary },

  desc: {
    fontSize: 13,
    color: HOME.textSecondary,
    lineHeight: 19,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  scroll: { maxHeight: 400 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 12, paddingTop: 4 },

  tierCard: {
    backgroundColor: HOME.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: HOME.border,
    gap: 8,
    marginBottom: 10,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierTitle: { fontSize: 15, fontWeight: '700', color: HOME.textPrimary },
  tierBadge: {
    backgroundColor: HOME.accent + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '600', color: HOME.accent },
  tierDesc: { fontSize: 13, color: HOME.textSecondary, lineHeight: 19 },
  tierFooter: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
  tierMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierMetricText: { fontSize: 12, color: HOME.textMuted },

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: HOME.border,
  },
  footerText: { fontSize: 11, color: HOME.textMuted, flex: 1, lineHeight: 15 },
});
