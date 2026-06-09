import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TabSwitcher from './tab-switcher';
import MoverRow from './mover-row';
import { useHomeData } from '@/hooks/use-home-data';
import { useUnusualVolume } from '@/hooks/use-unusual-volume';
import { HOME } from './home-tokens';
import { SectionError, SectionEmpty, Skeleton } from './section-states';
import type { StockQuote, UnusualVolumeStock } from '@/lib/api';

type Tab = 'gainers' | 'losers' | 'vol';

const TABS: { key: Tab; label: string }[] = [
  { key: 'gainers', label: 'Gainers' },
  { key: 'losers', label: 'Losers' },
  { key: 'vol', label: 'Unusual Vol.' },
];

interface MoverItem {
  ticker: string;
  name?: string;
  price: number | null;
  changePercent: number | null;
  logo?: string;
}

export default function TopMoversPanel() {
  const home = useHomeData();
  const vol = useUnusualVolume();
  const [active, setActive] = useState<Tab>('gainers');
  const [expanded, setExpanded] = useState(false);

  const items = useMemo<MoverItem[]>(() => {
    if (active === 'gainers') return mapQuotes(home.data?.topGainers ?? []);
    if (active === 'losers') return mapQuotes(home.data?.topLosers ?? []);
    return mapUnusual(vol.data ?? []);
  }, [active, home.data, vol.data]);

  const isLoading =
    (active === 'vol' && vol.isLoading) ||
    (active !== 'vol' && home.isLoading);
  const isError =
    (active === 'vol' && vol.isError && (vol.data?.length ?? 0) === 0) ||
    (active !== 'vol' && home.isError && !home.data);
  const errorMessage = active === 'vol' ? vol.error?.message : home.error?.message;

  const visible = expanded ? items.slice(0, 10) : items.slice(0, 5);
  const canExpand = items.length > 5;

  return (
    <View style={styles.section}>
      <TabSwitcher tabs={TABS} active={active} onChange={(k) => { setActive(k); setExpanded(false); }} />
      {isError ? (
        <SectionError message={errorMessage} onRetry={() => (active === 'vol' ? vol.refetch() : home.refetch())} />
      ) : isLoading ? (
        <View>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skelRow}>
              <Skeleton width={16} height={11} />
              <Skeleton width={28} height={28} radius={7} style={{ marginHorizontal: 8 }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="50%" height={12} />
                <View style={{ height: 4 }} />
                <Skeleton width="70%" height={9} />
              </View>
              <Skeleton width={56} height={12} style={{ marginRight: 8 }} />
              <Skeleton width={48} height={12} />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <SectionEmpty
          message={
            active === 'vol'
              ? 'No unusual volume data available'
              : 'No data available'
          }
        />
      ) : (
        <>
          {visible.map((m, i) => (
            <MoverRow
              key={`${active}-${m.ticker}-${i}`}
              rank={i + 1}
              ticker={m.ticker}
              name={m.name}
              price={m.price}
              changePercent={m.changePercent}
              logoUrl={m.logo}
            />
          ))}
          {canExpand && (
            <TouchableOpacity
              onPress={() => setExpanded((e) => !e)}
              style={styles.viewAllRow}
              accessibilityRole="button"
            >
              <Text style={styles.viewAllText}>{expanded ? 'Show less' : 'View all'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function mapQuotes(quotes: StockQuote[]): MoverItem[] {
  return quotes.map((q) => ({
    ticker: q.symbol,
    name: q.profile?.name,
    price: q.currentPrice ?? null,
    changePercent: q.changePercent ?? null,
    logo: q.profile?.logo,
  }));
}

function mapUnusual(rows: UnusualVolumeStock[]): MoverItem[] {
  return rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    price: r.currentPrice,
    changePercent: r.changePercent,
    logo: r.logo,
  }));
}

const styles = StyleSheet.create({
  section: { marginTop: 6, marginBottom: 8 },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewAllRow: { paddingVertical: 8, alignItems: 'center' },
  viewAllText: { color: HOME.accent, fontSize: 12, fontWeight: '600' },
});
