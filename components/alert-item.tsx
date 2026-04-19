import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { Radius, Shadow } from '@/constants/theme';
import type { AlertLog } from '@/lib/api';

interface AlertItemProps {
  alert: AlertLog;
  onMarkRead?: (id: string) => void;
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AlertItem({ alert, onMarkRead }: AlertItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const config = {
    '52w_high': { label: '52W HIGH', color: colors.alert52wHigh, emoji: '📈' },
    '52w_low': { label: '52W LOW', color: colors.alert52wLow, emoji: '📉' },
    rsi_overbought: { label: 'RSI OB', color: colors.alertRsiOB, emoji: '🔴' },
    rsi_oversold: { label: 'RSI OS', color: colors.alertRsiOS, emoji: '🟢' },
  }[alert.alert_type];

  const timeAgo = formatTimeAgo(alert.triggered_at);

  return (
    <TouchableOpacity
      style={[styles.card, !alert.is_read && styles.unread]}
      onPress={() => !alert.is_read && onMarkRead?.(alert.id)}
      activeOpacity={0.8}
    >
      {!alert.is_read && <View style={styles.unreadDot} />}

      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={styles.symbol}>{alert.symbol}</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>

      <Text style={styles.message}>{alert.message}</Text>

      {alert.price != null && (
        <Text style={styles.meta}>
          Price: <Text style={styles.metaValue}>${Number(alert.price).toFixed(2)}</Text>
          {alert.rsi != null && (
            <>  · RSI: <Text style={styles.metaValue}>{Number(alert.rsi).toFixed(1)}</Text></>
          )}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: Radius.md,
      padding: 16,
      marginBottom: 10,
      ...Shadow.card,
    },
    unread: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    unreadDot: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    symbol: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    time: { fontSize: 11, color: colors.textMuted },
    message: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 6 },
    meta: { fontSize: 12, color: colors.textMuted },
    metaValue: { fontWeight: '600', color: colors.textSecondary },
  });
}
