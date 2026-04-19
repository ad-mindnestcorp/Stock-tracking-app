import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from '@/hooks/use-alerts';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';
import AlertItem from '@/components/alert-item';
import { SkeletonAlertListScreen } from '@/components/skeleton';

export default function AlertsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: alerts = [], isLoading, isError, error, refetch, isRefetching } = useAlerts();
  const { mutate: markRead } = useMarkAlertRead();
  const { mutate: markAllRead } = useMarkAllAlertsRead();

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alerts</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllRead()}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { label: '52W HIGH', color: colors.alert52wHigh },
          { label: '52W LOW', color: colors.alert52wLow },
          { label: 'RSI OB', color: colors.alertRsiOB },
          { label: 'RSI OS', color: colors.alertRsiOS },
        ].map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {isError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Failed to load alerts'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <SkeletonAlertListScreen count={4} />
      ) : alerts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={56} color={colors.border} />
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptyText}>
            Add stocks to your watchlist and the system will alert you when RSI or 52-week conditions are triggered.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <AlertItem alert={item} onMarkRead={(id) => markRead(id)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
    markAllBtn: {
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.full,
      marginTop: 4,
    },
    markAllText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

    legend: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 12,
      flexWrap: 'wrap',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },

    errorCard: {
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: '#FEF2F2',
      borderRadius: Radius.md,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    errorText: { color: colors.negative, fontSize: 13 },
    retryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    list: { paddingHorizontal: 20, paddingBottom: 20 },
  });
}
