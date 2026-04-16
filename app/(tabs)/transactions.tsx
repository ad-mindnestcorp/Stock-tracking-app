import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { alertsApi, type AlertLog } from '@/lib/api';
import { Colors, Radius } from '@/constants/theme';

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

const ALERT_COLORS: Record<AlertLog['alert_type'], string> = {
  '52w_high': Colors.alert52wHigh,
  '52w_low': Colors.alert52wLow,
  rsi_overbought: Colors.alertRsiOB,
  rsi_oversold: Colors.alertRsiOS,
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
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setError(null);
      const data = await alertsApi.getAll();
      setSections(groupByDate(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Alert History</Text>
        <Text style={styles.subtitle}>All triggered signals</Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadHistory}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyText}>
            Triggered alerts will appear here grouped by date.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => <HistoryRow alert={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function HistoryRow({ alert }: { alert: AlertLog }) {
  const color = ALERT_COLORS[alert.alert_type];
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  errorCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorText: { color: Colors.negative, fontSize: 13 },
  retryText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 20, paddingBottom: 20 },

  sectionHeader: {
    paddingVertical: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowSymbol: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowTime: { fontSize: 12, color: Colors.textMuted },
  rowLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rowMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
});
