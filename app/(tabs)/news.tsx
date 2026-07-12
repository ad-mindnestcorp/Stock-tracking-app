import { HOME } from '@/components/home/home-tokens';
import { SectionError } from '@/components/home/section-states';
import NewsCard from '@/components/news/NewsCard';
import { TourTarget } from '@/components/tour/TourTarget';
import {
  useAggregatedNews,
  useInvalidateNews,
} from '@/hooks/use-aggregated-news';
import type { NewsFilter } from '@/lib/api';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS: { key: NewsFilter; label: string }[] = [
  { key: 'markets', label: 'Markets' },
  { key: 'my_stocks', label: 'My Stocks' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'economy', label: 'Economy' },
];

function FilterBar({
  active,
  onChange,
}: {
  active: NewsFilter;
  onChange: (f: NewsFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={fbStyles.row}
      style={fbStyles.scroll}
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <TouchableOpacity
            key={f.key}
            style={[fbStyles.pill, isActive && fbStyles.pillActive]}
            onPress={() => onChange(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[fbStyles.label, isActive && fbStyles.labelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const fbStyles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 14 },
  row: { paddingHorizontal: 16, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: HOME.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
  },
  pillActive: {
    backgroundColor: HOME.accent,
    borderColor: HOME.accent,
  },
  label: { fontSize: 12, fontWeight: '600', color: HOME.textSecondary },
  labelActive: { color: '#fff' },
});

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={slStyles.text}>{title}</Text>;
}

const slStyles = StyleSheet.create({
  text: {
    color: HOME.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
});

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <View style={skStyles.card}>
      <View style={skStyles.topRow}>
        <View style={skStyles.meta}>
          <View style={skStyles.dot} />
          <View style={skStyles.bar30} />
        </View>
        <View style={skStyles.icon} />
      </View>
      <View style={[skStyles.bar, { width: '95%', marginBottom: 4 }]} />
      <View style={[skStyles.bar, { width: '70%' }]} />
      <View style={skStyles.chipsRow}>
        <View style={skStyles.chip} />
        <View style={skStyles.chip} />
      </View>
    </View>
  );
}

const SKELETON_BG = '#1a1a1a';
const skStyles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: HOME.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
    padding: 14,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SKELETON_BG },
  bar30: { width: 80, height: 9, borderRadius: 5, backgroundColor: SKELETON_BG },
  icon: { width: 40, height: 40, borderRadius: 8, backgroundColor: SKELETON_BG },
  bar: { height: 11, borderRadius: 5, backgroundColor: SKELETON_BG, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', marginTop: 4, gap: 6 },
  chip: { width: 56, height: 20, borderRadius: 6, backgroundColor: SKELETON_BG },
});

// ─── New-stories banner ───────────────────────────────────────────────────────

function NewsBanner({ count, onTap }: { count: number; onTap: () => void }) {
  return (
    <TouchableOpacity style={bannerStyles.wrap} onPress={onTap} activeOpacity={0.8}>
      <Text style={bannerStyles.text}>
        {count} new {count === 1 ? 'story' : 'stories'} — tap to refresh
      </Text>
    </TouchableOpacity>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: {
    backgroundColor: HOME.accent,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'center',
    marginBottom: 14,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

// ─── NewsScreen ───────────────────────────────────────────────────────────────

export default function NewsScreen() {
  const [filter, setFilter] = useState<NewsFilter>('markets');
  const [refreshing, setRefreshing] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const invalidateNews = useInvalidateNews();
  const prevIdsRef = useRef<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useAggregatedNews(filter);

  // Track new articles silently after a background refresh
  const currentIds = new Set([
    ...(data?.topStories ?? []).map((a) => a.id),
    ...(data?.moreNews ?? []).map((a) => a.id),
  ]);
  if (prevIdsRef.current.size > 0 && data) {
    let diff = 0;
    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) diff++;
    }
    if (diff > 0 && diff !== newCount) setNewCount(diff);
  }

  const handleBannerTap = useCallback(() => {
    prevIdsRef.current = currentIds;
    setNewCount(0);
    invalidateNews();
  }, [currentIds, invalidateNews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    prevIdsRef.current = currentIds;
    setNewCount(0);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch, currentIds]);

  // Update prevIds on first load
  if (prevIdsRef.current.size === 0 && currentIds.size > 0) {
    prevIdsRef.current = new Set(currentIds);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>News</Text>
      </View>

      <TourTarget stepId="news_screen">
        <FilterBar active={filter} onChange={setFilter} />
      </TourTarget>

      {newCount > 0 && (
        <View style={styles.bannerWrap}>
          <NewsBanner count={newCount} onTap={handleBannerTap} />
        </View>
      )}

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
        {isError && (
          <SectionError
            message={error?.message ?? "Couldn't load news"}
            onRetry={() => refetch()}
          />
        )}

        {isLoading && !data && (
          <>
            <SectionLabel title="Top Stories" />
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            <SectionLabel title="More News" />
            {[3, 4, 5].map((i) => <CardSkeleton key={i} />)}
          </>
        )}

        {data && (
          <>
            {data.topStories.length > 0 && (
              <>
                <SectionLabel title="Top Stories" />
                {data.topStories.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </>
            )}

            {data.moreNews.length > 0 && (
              <>
                <SectionLabel title="More News" />
                {data.moreNews.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </>
            )}

            {data.topStories.length === 0 && data.moreNews.length === 0 && (
              <View style={styles.empty}>
                <ActivityIndicator color={HOME.accent} />
                <Text style={styles.emptyText}>No news available</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HOME.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '700', color: HOME.textPrimary },
  bannerWrap: { paddingHorizontal: 16 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  empty: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { color: HOME.textSecondary, fontSize: 14 },
});
