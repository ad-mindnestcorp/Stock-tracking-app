import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useEarningsCalendar } from '@/hooks/use-earnings-calendar';
import { earningsHourLabel } from '@/lib/formatters';
import { HOME } from './home-tokens';
import { SectionEmpty, Skeleton } from './section-states';

export default function EarningsTodayGrid() {
  const { data, isLoading } = useEarningsCalendar(new Date());

  const todays = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return (data ?? []).filter((e) => e.date === todayStr).slice(0, 8);
  }, [data]);

  if (isLoading && !data) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton width={34} height={34} radius={9} />
            <View style={{ height: 6 }} />
            <Skeleton width={36} height={11} />
            <View style={{ height: 4 }} />
            <Skeleton width={50} height={9} />
          </View>
        ))}
      </View>
    );
  }

  if (todays.length === 0) {
    return <SectionEmpty message="No earnings reports today" />;
  }

  return (
    <View style={styles.grid}>
      {todays.slice(0, 4).map((e) => (
        <TouchableOpacity
          key={e.symbol}
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => router.push(`/stock/${e.symbol}` as never)}
          accessibilityRole="button"
          accessibilityLabel={`${e.symbol} earnings ${earningsHourLabel(e.hour)}`}
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>{e.symbol.slice(0, 1)}</Text>
          </View>
          <Text style={styles.ticker}>{e.symbol}</Text>
          <Text style={styles.time}>{earningsHourLabel(e.hour)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 6,
  },
  card: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222222',
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoText: {
    color: HOME.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  ticker: {
    color: HOME.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  time: {
    color: HOME.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
});
