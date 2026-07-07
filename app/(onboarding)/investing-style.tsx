import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StepProgress } from '@/components/onboarding/step-progress';
import { useOnboarding } from '@/context/onboarding-context';
import { track } from '@/lib/analytics';
import type { InvestingStyle } from '@/lib/onboarding-storage';

const STYLES: Array<{
  id: InvestingStyle;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  {
    id: 'long_term',
    label: 'Long-term Investor',
    description: 'Holding for months or years. Focused on fundamentals and growth.',
    icon: 'trending-up-outline',
  },
  {
    id: 'swing',
    label: 'Swing Trader',
    description: 'Riding momentum over days or weeks. Technical and trend-driven.',
    icon: 'pulse-outline',
  },
  {
    id: 'active',
    label: 'Active Trader',
    description: 'High-frequency trades. Charts, volume, and intraday moves.',
    icon: 'flash-outline',
  },
  {
    id: 'exploring',
    label: 'Exploring',
    description: 'Still figuring it out. Learning the markets at my own pace.',
    icon: 'compass-outline',
  },
];

export default function InvestingStyleScreen() {
  const { setInvestingStyle } = useOnboarding();
  const [selected, setSelected] = useState<InvestingStyle | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    await setInvestingStyle(selected);
    track('onboarding_step_completed', { step: 'investing_style', value: selected });
    router.push('/(onboarding)/goals');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <StepProgress totalSteps={4} currentStep={0} />
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headline}>What's your{'\n'}investing style?</Text>
          <Text style={styles.subtitle}>
            We'll personalize your feed based on how you invest.
          </Text>

          <View style={styles.options}>
            {STYLES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, selected === item.id && styles.cardSelected]}
                onPress={() => setSelected(item.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, selected === item.id && styles.iconWrapSelected]}>
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={selected === item.id ? '#0a0a0a' : '#CCFF00'}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.cardLabel, selected === item.id && styles.cardLabelSelected]}>
                    {item.label}
                  </Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                </View>
                {selected === item.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#CCFF00" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
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
    paddingBottom: 20,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 21,
    marginBottom: 28,
  },
  options: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  cardSelected: {
    borderColor: '#CCFF00',
    backgroundColor: '#1a1f0a',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#CCFF0018',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: '#CCFF00',
  },
  cardText: { flex: 1 },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 3,
  },
  cardLabelSelected: { color: '#CCFF00' },
  cardDesc: { fontSize: 12, color: '#888888', lineHeight: 17 },
  continueBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  continueBtnDisabled: { opacity: 0.35 },
  continueBtnText: { fontSize: 16, fontWeight: '800', color: '#0a0a0a' },
});
