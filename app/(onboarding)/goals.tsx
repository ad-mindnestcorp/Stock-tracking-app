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
import type { OnboardingGoal } from '@/lib/onboarding-storage';

const MAX_GOALS = 3;

const GOALS: Array<{
  id: OnboardingGoal;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  { id: 'trending_stocks', label: 'Find Trending Stocks', icon: 'flame-outline' },
  { id: 'momentum', label: 'Discover Momentum Opportunities', icon: 'rocket-outline' },
  { id: 'track_earnings', label: 'Track Earnings', icon: 'calendar-outline' },
  { id: 'market_moves', label: 'Understand Market Moves', icon: 'bar-chart-outline' },
  { id: 'ai_research', label: 'AI Stock Research', icon: 'sparkles-outline' },
  { id: 'monitor_portfolio', label: 'Monitor Portfolio', icon: 'pie-chart-outline' },
];

export default function GoalsScreen() {
  const { setGoals } = useOnboarding();
  const [selected, setSelected] = useState<OnboardingGoal[]>([]);

  const toggle = (id: OnboardingGoal) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id);
      if (prev.length >= MAX_GOALS) return prev;
      return [...prev, id];
    });
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    await setGoals(selected);
    track('onboarding_step_completed', { step: 'goals', count: selected.length });
    router.push('/(onboarding)/stock-selection');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <StepProgress totalSteps={4} currentStep={1} />
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headline}>What are your{'\n'}investing goals?</Text>
          <Text style={styles.subtitle}>
            Choose up to {MAX_GOALS} goals. We'll surface what matters most.
          </Text>

          <View style={styles.counter}>
            <Text style={styles.counterText}>
              <Text style={styles.counterNum}>{selected.length}</Text> / {MAX_GOALS} selected
            </Text>
          </View>

          <View style={styles.grid}>
            {GOALS.map((goal) => {
              const isSelected = selected.includes(goal.id);
              const isDisabled = !isSelected && selected.length >= MAX_GOALS;
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                    isDisabled && styles.cardDisabled,
                  ]}
                  onPress={() => toggle(goal.id)}
                  disabled={isDisabled}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                    <Ionicons
                      name={goal.icon}
                      size={20}
                      color={isSelected ? '#0a0a0a' : '#CCFF00'}
                    />
                  </View>
                  <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                    {goal.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color="#CCFF00" style={styles.check} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.continueBtn, selected.length === 0 && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={selected.length === 0}
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
    marginBottom: 16,
  },
  counter: { marginBottom: 20 },
  counterText: { fontSize: 13, color: '#888888' },
  counterNum: { color: '#CCFF00', fontWeight: '700' },
  grid: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  cardSelected: {
    borderColor: '#CCFF00',
    backgroundColor: '#1a1f0a',
  },
  cardDisabled: { opacity: 0.4 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#CCFF0018',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: '#CCFF00' },
  cardLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardLabelSelected: { color: '#CCFF00' },
  check: { marginLeft: 'auto' },
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
