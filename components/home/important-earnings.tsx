import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useImportantEarnings, type ImportantEarningsEntry } from '@/hooks/use-important-earnings';
import { HOME } from './home-tokens';
import { SectionEmpty, SectionError, Skeleton } from './section-states';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${MONTH_ABBR[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function fmtMarketCap(capM: number): string {
  if (capM >= 1_000_000) return `$${(capM / 1_000_000).toFixed(2)}T`;
  if (capM >= 1_000) return `$${(capM / 1_000).toFixed(2)}T`;
  return `$${(capM / 1_000).toFixed(2)}B`;
}

function fmtMarketCapFull(capM: number): string {
  if (capM >= 1_000_000) return `$${(capM / 1_000_000).toFixed(2)}T`;
  if (capM >= 1_000) return `$${(capM / 1_000).toFixed(2)}B`;
  return `$${capM.toFixed(0)}M`;
}

function capSizeLabel(capM: number): string {
  if (capM >= 200_000) return 'Large Cap';
  if (capM >= 10_000) return 'Mid Cap';
  return 'Small Cap';
}

function timeLabel(hour: ImportantEarningsEntry['hour']): string {
  if (hour === 'bmo') return 'Before Market';
  if (hour === 'amc') return 'After Market';
  if (hour === 'dmh') return 'During Hours';
  return 'TBD';
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function CompanyLogo({ uri, symbol, size = 36 }: { uri: string; symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size * 0.25 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[styles.logoFallback, { width: size, height: size, borderRadius: size * 0.25 }]}>
      <Text style={[styles.logoFallbackText, { fontSize: size * 0.38 }]}>
        {symbol.slice(0, 1)}
      </Text>
    </View>
  );
}

// ─── Row (Today / Tomorrow) ───────────────────────────────────────────────────

function EarningsRow({ item }: { item: ImportantEarningsEntry }) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push(`/stock/${item.symbol}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${item.symbol} earnings`}
    >
      {/* Company */}
      <View style={styles.rowCompany}>
        <CompanyLogo uri={item.logo} symbol={item.symbol} size={36} />
        <View style={styles.rowCompanyText}>
          <View style={styles.rowTickerRow}>
            <Text style={styles.rowTicker}>{item.symbol}</Text>
          </View>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        </View>
      </View>

      {/* Market Cap */}
      <View style={styles.rowCell}>
        <Text style={styles.rowValue}>{fmtMarketCapFull(item.marketCap)}</Text>
        <Text style={styles.rowSub}>{capSizeLabel(item.marketCap)}</Text>
      </View>

      {/* EPS Estimate */}
      <View style={styles.rowCell}>
        {item.epsEstimate != null ? (
          <>
            <Text style={styles.rowValue}>${item.epsEstimate.toFixed(2)}</Text>
            <Text
              style={[
                styles.rowEps,
                { color: item.epsEstimate >= 0 ? HOME.positive : HOME.negative },
              ]}
            >
              {item.epsEstimate >= 0 ? '+' : ''}{item.epsEstimate.toFixed(2)}
            </Text>
          </>
        ) : (
          <Text style={styles.rowSub}>—</Text>
        )}
      </View>

      {/* Time */}
      <View style={[styles.rowCell, styles.rowCellRight]}>
        <Text style={styles.rowTimeDot}>☀</Text>
        <Text style={styles.rowTime}>{timeLabel(item.hour)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderText, { flex: 2 }]}>Company</Text>
      <Text style={styles.tableHeaderText}>Market Cap</Text>
      <Text style={styles.tableHeaderText}>EPS Est.</Text>
      <Text style={[styles.tableHeaderText, styles.tableHeaderRight]}>Time</Text>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  badge,
  count,
}: {
  icon: string;
  label: string;
  badge: string;
  count: number;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{badge}</Text>
        </View>
      </View>
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>{count} {count === 1 ? 'Company' : 'Companies'}</Text>
      </View>
    </View>
  );
}

// ─── Next 7 Days compact card ─────────────────────────────────────────────────

function Next7Card({ item }: { item: ImportantEarningsEntry }) {
  return (
    <TouchableOpacity
      style={styles.compactCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/stock/${item.symbol}` as never)}
    >
      <CompanyLogo uri={item.logo} symbol={item.symbol} size={32} />
      <Text style={styles.compactTicker}>{item.symbol}</Text>
      <Text style={styles.compactName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
      <View style={styles.compactDateRow}>
        <Text style={styles.compactDateIcon}>📅</Text>
        <Text style={styles.compactDate}>{fmtDate(item.date)}</Text>
      </View>
      {item.epsEstimate != null && (
        <Text style={styles.compactEps}>EPS ${item.epsEstimate.toFixed(2)}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <View style={[styles.row, { gap: 12 }]}>
      <Skeleton width={36} height={36} radius={9} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={50} height={11} />
        <Skeleton width={90} height={9} />
      </View>
      <Skeleton width={55} height={11} />
      <Skeleton width={40} height={11} />
      <Skeleton width={60} height={11} />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportantEarnings() {
  const { data, isLoading, error, refetch } = useImportantEarnings();
  const [showAllNext7, setShowAllNext7] = useState(false);

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const day7 = addDays(today, 7);

  const todayBadge = formatDisplayDate(today);
  const tomorrowBadge = formatDisplayDate(tomorrow);
  const next7Badge = `${fmtDate(formatYMD(addDays(today, 2)))} – ${fmtDate(formatYMD(day7))}`;

  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <View style={styles.section}>
          <RowSkeleton />
          <RowSkeleton />
        </View>
        <View style={styles.section}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <SectionError
        message={error instanceof Error ? error.message : 'Unable to load earnings data'}
        onRetry={refetch}
        style={{ marginTop: 12 }}
      />
    );
  }

  const todayList = data?.today ?? [];
  const tomorrowList = data?.tomorrow ?? [];
  const next7List = data?.nextSevenDays ?? [];
  const visibleNext7 = showAllNext7 ? next7List : next7List.slice(0, 8);

  return (
    <View style={styles.container}>
      {/* Today */}
      <View style={styles.section}>
        <SectionHeader icon="☀️" label="Today" badge={todayBadge} count={todayList.length} />
        {todayList.length === 0 ? (
          <SectionEmpty message="No major earnings today" />
        ) : (
          <View style={styles.table}>
            <TableHeader />
            {todayList.map((item) => (
              <EarningsRow key={`today-${item.symbol}`} item={item} />
            ))}
          </View>
        )}
      </View>

      {/* Tomorrow */}
      <View style={styles.section}>
        <SectionHeader icon="📅" label="Tomorrow" badge={tomorrowBadge} count={tomorrowList.length} />
        {tomorrowList.length === 0 ? (
          <SectionEmpty message="No major earnings tomorrow" />
        ) : (
          <View style={styles.table}>
            <TableHeader />
            {tomorrowList.map((item) => (
              <EarningsRow key={`tmrw-${item.symbol}`} item={item} />
            ))}
          </View>
        )}
      </View>

      {/* Next 7 Days */}
      <View style={styles.section}>
        <SectionHeader icon="📅" label="Next 7 Days" badge={next7Badge} count={next7List.length} />
        {next7List.length === 0 ? (
          <SectionEmpty message="No major earnings in the next 7 days" />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.compactScroll}
            >
              {visibleNext7.map((item) => (
                <Next7Card key={`n7-${item.symbol}-${item.date}`} item={item} />
              ))}
            </ScrollView>
            {next7List.length > 8 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => setShowAllNext7((v) => !v)}
              >
                <Text style={styles.viewAllText}>
                  {showAllNext7 ? 'Show Less' : `View All (${next7List.length})`} {showAllNext7 ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Display date helper ──────────────────────────────────────────────────────

function formatDisplayDate(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingTop: 8,
  },
  section: {
    gap: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  dateBadge: {
    backgroundColor: '#1a2a3a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dateBadgeText: {
    fontSize: 11,
    color: HOME.accent,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: HOME.card,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
  },
  countBadgeText: {
    fontSize: 11,
    color: HOME.textSecondary,
    fontWeight: '600',
  },
  table: {
    backgroundColor: HOME.card,
    borderRadius: HOME.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.border,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 11,
    color: HOME.textMuted,
    fontWeight: '500',
  },
  tableHeaderRight: {
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.borderSoft,
  },
  rowCompany: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowCompanyText: {
    flex: 1,
    gap: 2,
  },
  rowTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowTicker: {
    fontSize: 13,
    fontWeight: '700',
    color: HOME.textPrimary,
  },
  rowName: {
    fontSize: 10,
    color: HOME.textSecondary,
  },
  rowCell: {
    flex: 1,
    gap: 2,
  },
  rowCellRight: {
    alignItems: 'flex-end',
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '600',
    color: HOME.textPrimary,
  },
  rowSub: {
    fontSize: 10,
    color: HOME.textSecondary,
  },
  rowEps: {
    fontSize: 10,
    fontWeight: '600',
  },
  rowTimeDot: {
    fontSize: 11,
  },
  rowTime: {
    fontSize: 10,
    color: HOME.textSecondary,
  },
  logoFallback: {
    backgroundColor: HOME.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    color: HOME.textPrimary,
    fontWeight: '700',
  },
  compactScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  compactCard: {
    width: 110,
    backgroundColor: HOME.card,
    borderRadius: HOME.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
    padding: 10,
    gap: 4,
    alignItems: 'flex-start',
  },
  compactTicker: {
    fontSize: 13,
    fontWeight: '700',
    color: HOME.textPrimary,
    marginTop: 4,
  },
  compactName: {
    fontSize: 10,
    color: HOME.textSecondary,
  },
  compactDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  compactDateIcon: {
    fontSize: 10,
  },
  compactDate: {
    fontSize: 10,
    color: HOME.textSecondary,
  },
  compactEps: {
    fontSize: 11,
    fontWeight: '600',
    color: HOME.positive,
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  viewAllText: {
    fontSize: 13,
    color: HOME.accent,
    fontWeight: '600',
  },
});
