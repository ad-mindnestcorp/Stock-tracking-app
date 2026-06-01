import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import IndexCardsRow from '@/components/home/index-cards-row';
import HeatmapCalendarPanel from '@/components/home/heatmap-calendar-panel';
import TopMoversPanel from '@/components/home/top-movers-panel';
import { HOME } from '@/components/home/home-tokens';

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['market'] });
      await queryClient.invalidateQueries({ queryKey: ['home'] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <SafeAreaView style={styles.safe}>
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
        <IndexCardsRow />
        <HeatmapCalendarPanel />
        <TopMoversPanel />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Home</Text>
      <View style={styles.icons}>
        {/* TODO: navigate to Search screen (Feature 9) */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={8}
        >
          <Ionicons name="search-outline" size={22} color={HOME.textPrimary} />
        </TouchableOpacity>
        {/* TODO: wire to alerts tab once tab structure update is approved */}
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
