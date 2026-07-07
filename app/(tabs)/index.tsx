import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

import IndexCardsRow from '@/components/home/index-cards-row';
import HeatmapCalendarPanel from '@/components/home/heatmap-calendar-panel';
import TopMoversPanel from '@/components/home/top-movers-panel';
import YourStocksPanel from '@/components/home/your-stocks-panel';
import { HOME } from '@/components/home/home-tokens';
import { useOnboarding } from '@/context/onboarding-context';
import { track } from '@/lib/analytics';
import type { OnboardingGoal } from '@/lib/onboarding-storage';

function getPanelOrder(goals: OnboardingGoal[]): ('your_stocks' | 'indexes' | 'movers')[] {
  if (goals.includes('monitor_portfolio')) {
    return ['your_stocks', 'indexes', 'movers'];
  }
  if (goals.includes('trending_stocks') || goals.includes('momentum')) {
    return ['indexes', 'movers', 'your_stocks'];
  }
  if (goals.includes('market_moves') || goals.includes('track_earnings')) {
    return ['indexes', 'your_stocks', 'movers'];
  }
  return ['indexes', 'movers', 'your_stocks'];
}

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data: onboardingData, isComplete } = useOnboarding();

  useEffect(() => {
    if (isComplete) {
      track('first_value_viewed', {
        investing_style: onboardingData.investingStyle,
        goals: onboardingData.goals,
      });
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['market'] });
      await queryClient.invalidateQueries({ queryKey: ['home'] });
      await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const panelOrder = getPanelOrder(onboardingData.goals);

  const panels: Record<string, React.ReactNode> = {
    indexes: <IndexCardsRow key="indexes" />,
    movers: <TopMoversPanel key="movers" />,
    your_stocks: isComplete ? <YourStocksPanel key="your_stocks" /> : null,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={HOME.accent}
          />
        }
      >
        <Header />
        <HeatmapCalendarPanel />
        {panelOrder.map((key) => panels[key])}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Home</Text>
      <View style={styles.icons}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={8}
        >
          <Ionicons name="search-outline" size={22} color={HOME.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={22} color={HOME.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HOME.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  icons: { flexDirection: 'row', gap: 18, alignItems: 'center' },
});
