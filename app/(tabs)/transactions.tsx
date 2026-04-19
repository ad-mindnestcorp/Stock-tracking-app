import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts } from '@/hooks/use-alerts';
import { type AlertLog } from '@/lib/api';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';
import { SkeletonListScreen } from '@/components/skeleton';

interface Section {
  title: string;
  data: AlertLog[];
}

const ALERT_LABELS: Record<AlertLog['alert_type'], string> = {
  '52w_high': '52-Week High',
  '52w_low': '52-Week Low',
  rsi_overbought: 'RSI Overbought',
  rsi_oversold: 'RSI Oversold',
};

function groupByDate(alerts: AlertLog[]): Section[] {
  const groups = new Map<string, AlertLog[]>();
  for (const alert of alerts) {
    const date = new Date(alert.triggered_at);
    const label = isToday(date)
      ? 'Today'
      : isYesterday(date)
      ? 'Yesterday'
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(alert);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: alerts = [], isLoading, isError, error, refetch, isRefetching } = useAlerts();
  const sections = useMemo(() => groupByDate(alerts), [alerts]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Alert History</Text>
        <Text style={styles.subtitle}>All triggered signals</Text>
      </View>

      {isError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Failed to load history'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <SkeletonListScreen count={6} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={56} color={colors.border} />
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyText}>Triggered alerts will appear here grouped by date.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => <HistoryRow alert={item} colors={colors} styles={styles} />}
        />
      )}
    </SafeAreaView>
  );
}

function HistoryRow({
  alert,
  colors,
  styles,
}: {
  alert: AlertLog;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const color = {
    '52w_high': colors.alert52wHigh,
    '52w_low': colors.alert52wLow,
    rsi_overbought: colors.alertRsiOB,
    rsi_oversold: colors.alertRsiOS,
  }[alert.alert_type];

  const label = ALERT_LABELS[alert.alert_type];
  const time = new Date(alert.triggered_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowSymbol}>{alert.symbol}</Text>
          <Text style={styles.rowTime}>{time}</Text>
        </View>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        {alert.price != null && (
          <Text style={styles.rowMeta}>
            ${Number(alert.price).toFixed(2)}
            {alert.rsi != null ? `  ·  RSI ${Number(alert.rsi).toFixed(1)}` : ''}
          </Text>
        )}
      </View>
      {!alert.is_read && <View style={styles.unreadDot} />}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

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
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

    list: { paddingHorizontal: 20, paddingBottom: 20 },

    sectionHeader: { paddingVertical: 10, marginTop: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    rowInfo: { flex: 1 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
    rowSymbol: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    rowTime: { fontSize: 12, color: colors.textMuted },
    rowLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.primary,
      flexShrink: 0,
    },
  });
}
