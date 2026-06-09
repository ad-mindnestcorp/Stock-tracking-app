import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEarningsCalendar } from '@/hooks/use-earnings-calendar';
import { useEconomicCalendar } from '@/hooks/use-economic-calendar';
import { earningsHourLabel } from '@/lib/formatters';
import { HOME } from './home-tokens';
import { SectionError, Skeleton } from './section-states';
import type { EarningsCalendarItem, EconomicCalendarItem } from '@/lib/finnhub-direct';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarEvent {
  type: 'earnings' | 'macro';
  date: Date;
  title: string;
  subtitle: string;
  ticker?: string;
  hour?: string;
}

export default function Calendar() {
  const [anchor, setAnchor] = useState(() => new Date());
  const earnings = useEarningsCalendar(anchor);
  const economic = useEconomicCalendar();

  const monthInfo = useMemo(() => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    return { year, month, daysInMonth, startWeekday, firstDay, lastDay };
  }, [anchor]);

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];

    for (const e of earnings.data ?? []) {
      const d = new Date(e.date + 'T00:00:00');
      if (
        d.getFullYear() === monthInfo.year &&
        d.getMonth() === monthInfo.month
      ) {
        list.push({
          type: 'earnings',
          date: d,
          title: e.symbol,
          subtitle: `${e.symbol} Earnings`,
          ticker: e.symbol,
          hour: e.hour,
        });
      }
    }

    for (const e of economic.data ?? []) {
      const t = e.time ? new Date(e.time.replace(' ', 'T')) : null;
      if (
        t &&
        !Number.isNaN(t.getTime()) &&
        t.getFullYear() === monthInfo.year &&
        t.getMonth() === monthInfo.month
      ) {
        list.push({
          type: 'macro',
          date: t,
          title: e.event,
          subtitle: `${e.country} · ${e.event}`,
        });
      }
    }

    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [earnings.data, economic.data, monthInfo]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, { earnings: boolean; macro: boolean }>();
    for (const e of events) {
      const day = e.date.getDate();
      const entry = map.get(day) ?? { earnings: false, macro: false };
      if (e.type === 'earnings') entry.earnings = true;
      else entry.macro = true;
      map.set(day, entry);
    }
    return map;
  }, [events]);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === monthInfo.year && today.getMonth() === monthInfo.month;

  const goPrev = () =>
    setAnchor(new Date(monthInfo.year, monthInfo.month - 1, 1));
  const goNext = () =>
    setAnchor(new Date(monthInfo.year, monthInfo.month + 1, 1));

  const isLoading = earnings.isLoading || economic.isLoading;
  const isError = earnings.isError && economic.isError;
  const calendarErrorMessage = earnings.error?.message ?? economic.error?.message;

  if (isError) {
    return (
      <SectionError
        message={calendarErrorMessage}
        onRetry={() => {
          earnings.refetch();
          economic.refetch();
        }}
      />
    );
  }

  const prevMonthIdx = (monthInfo.month + 11) % 12;
  const nextMonthIdx = (monthInfo.month + 1) % 12;

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={goPrev} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month">
          <View style={styles.navItem}>
            <Ionicons name="chevron-back" size={12} color={HOME.textSecondary} />
            <Text style={styles.navText}>{SHORT_MONTH[prevMonthIdx]}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {MONTH_NAMES[monthInfo.month]} {monthInfo.year}
        </Text>
        <TouchableOpacity onPress={goNext} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next month">
          <View style={styles.navItem}>
            <Text style={styles.navText}>{SHORT_MONTH[nextMonthIdx]}</Text>
            <Ionicons name="chevron-forward" size={12} color={HOME.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {DOW.map((d) => (
          <View key={d} style={styles.cell}>
            <Text style={styles.dow}>{d}</Text>
          </View>
        ))}
        {Array.from({ length: monthInfo.startWeekday }).map((_, i) => (
          <View key={`pad-${i}`} style={styles.cell} />
        ))}
        {Array.from({ length: monthInfo.daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = isCurrentMonth && day === today.getDate();
          const ev = eventsByDay.get(day);
          return (
            <View key={day} style={styles.cell}>
              <View style={[styles.dateInner, isToday && styles.dateToday]}>
                <Text style={[styles.dateText, isToday && styles.dateTextToday]}>
                  {day}
                </Text>
                {ev && (
                  <View style={styles.dotsRow}>
                    {ev.earnings && <View style={[styles.dot, { backgroundColor: HOME.positive }]} />}
                    {ev.macro && <View style={[styles.dot, { backgroundColor: HOME.accent }]} />}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.upcomingHeader}>UPCOMING EVENTS</Text>
      {isLoading && (earnings.data == null || economic.data == null) ? (
        <View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.eventRow}>
              <Skeleton width={6} height={6} radius={3} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Skeleton width="40%" height={12} />
                <View style={{ height: 4 }} />
                <Skeleton width="60%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>No events this month</Text>
      ) : (
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {events.slice(0, 20).map((e, i) => (
            <EventRow key={`${e.type}-${i}-${e.date.toISOString()}`} event={e} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const isEarnings = event.type === 'earnings';
  const dateLabel = `${SHORT_MONTH[event.date.getMonth()]} ${event.date.getDate()}`;
  const badge = isEarnings ? earningsHourLabel(event.hour) : 'Macro';
  const badgeStyle = isEarnings
    ? event.hour === 'amc'
      ? { backgroundColor: HOME.badgeRedBg, color: HOME.negative }
      : { backgroundColor: HOME.badgeEarningsBg, color: HOME.positive }
    : { backgroundColor: HOME.badgeMacroBg, color: HOME.accent };

  const onPress = () => {
    if (isEarnings && event.ticker) {
      router.push(`/stock/${event.ticker}` as never);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={isEarnings ? 0.7 : 1}
      style={styles.eventRow}
      accessibilityRole={isEarnings ? 'button' : 'text'}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: isEarnings
              ? event.hour === 'amc'
                ? HOME.negative
                : HOME.positive
              : HOME.accent,
          },
        ]}
      />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventSubtitle} numberOfLines={1}>
          {event.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.eventDate}>{dateLabel}</Text>
        <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.color }]}>{badge}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navText: { color: HOME.textSecondary, fontSize: 12 },
  headerTitle: { color: HOME.textPrimary, fontSize: 14, fontWeight: '700' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    paddingVertical: 4,
    alignItems: 'center',
  },
  dow: { color: HOME.textMuted, fontSize: 10 },
  dateInner: {
    width: 30,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  dateToday: { backgroundColor: HOME.accent },
  dateText: { color: '#aaaaaa', fontSize: 12 },
  dateTextToday: { color: '#ffffff', fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  upcomingHeader: {
    color: HOME.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: { color: HOME.textSecondary, fontSize: 12, paddingVertical: 8 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.borderSoft,
  },
  eventTitle: { color: HOME.textPrimary, fontSize: 13, fontWeight: '700' },
  eventSubtitle: { color: HOME.textMuted, fontSize: 10, marginTop: 1 },
  eventDate: { color: HOME.textSecondary, fontSize: 10 },
  badge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '600' },
});
