import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useIndexes } from '@/hooks/use-indexes';
import { useLivePrices, type LivePrice } from '@/hooks/use-live-prices';
import LineChart from '@/components/line-chart';
import { formatNumberCompact, formatPercent } from '@/lib/formatters';
import { HOME, getChangeColor } from './home-tokens';
import { SectionError, Skeleton } from './section-states';
import type { IndexCardData } from '@/lib/api';

const ITEMS_PER_VIEW = 3;
const CARD_GAP = 8;
const OUTER_H_PADDING = 16; // matches home screen paddingHorizontal
const CARD_V_PADDING = 10;
const CARD_H_PADDING = 10;
const CARD_HEIGHT = 96;
const SPARKLINE_HEIGHT = 22;
const AUTO_SLIDE_MS = 3000;

export default function IndexCardsRow() {
  const { data, isLoading, isError, error, refetch } = useIndexes();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const currentIndexRef = useRef(0);
  const hasInitialized = useRef(false);

  const symbols = useMemo(() => data?.map((c) => c.symbol) ?? [], [data]);
  const livePrices = useLivePrices(symbols);

  const pageWidth = screenWidth - OUTER_H_PADDING * 2;
  const cardWidth = (pageWidth - CARD_GAP * (ITEMS_PER_VIEW - 1)) / ITEMS_PER_VIEW;
  const snapWidth = cardWidth + CARD_GAP;
  const sparklineWidth = cardWidth - CARD_H_PADDING * 2;

  const n = data?.length ?? 0;
  // Triple the data so we can silently reset to the middle copy at either end
  const items: IndexCardData[] = data ? [...data, ...data, ...data] : [];

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      scrollRef.current?.scrollTo({ x: index * snapWidth, animated });
      currentIndexRef.current = index;
    },
    [snapWidth]
  );

  // After scrolling, silently jump back to the middle copy if we've drifted to the edges
  const maybeReset = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx >= n * 2) scrollToIndex(idx - n, false);
    else if (idx < n) scrollToIndex(idx + n, false);
  }, [n, scrollToIndex]);

  // Position to middle copy on first layout so both left and right swipe are available
  const handleLayout = useCallback(() => {
    if (!hasInitialized.current && n > 0) {
      hasInitialized.current = true;
      scrollToIndex(n, false);
    }
  }, [n, scrollToIndex]);

  // Auto-advance one card every AUTO_SLIDE_MS
  useEffect(() => {
    if (n === 0) return;
    const timer = setInterval(() => {
      const next = currentIndexRef.current + 1;
      scrollToIndex(next, true);
      // After the slide animation (~300 ms) silently reset if near edges
      setTimeout(maybeReset, 350);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [n, scrollToIndex, maybeReset]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      currentIndexRef.current = Math.round(e.nativeEvent.contentOffset.x / snapWidth);
      maybeReset();
    },
    [snapWidth, maybeReset]
  );

  if (isError) {
    return (
      <View style={styles.skeletonRow}>
        <SectionError message={error?.message} onRetry={() => refetch()} style={{ flex: 1 }} />
      </View>
    );
  }

  if (isLoading || !data) {
    return (
      <View style={styles.skeletonRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.card, { width: cardWidth }]}>
            <Skeleton width="60%" height={9} />
            <View style={{ height: 6 }} />
            <Skeleton width="80%" height={14} />
            <View style={{ height: 4 }} />
            <Skeleton width="50%" height={10} />
            <View style={{ height: 4 }} />
            <Skeleton width="100%" height={SPARKLINE_HEIGHT} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapWidth}
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        onLayout={handleLayout}
      >
        {items.map((card, i) => (
          <IndexCard
            key={`${card.symbol}-${i}`}
            card={card}
            cardWidth={cardWidth}
            sparklineWidth={sparklineWidth}
            livePrice={livePrices[card.symbol]}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function IndexCard({
  card,
  cardWidth,
  sparklineWidth,
  livePrice,
}: {
  card: IndexCardData;
  cardWidth: number;
  sparklineWidth: number;
  livePrice?: LivePrice;
}) {
  // Overlay live price; derive changePercent from previousClose estimate
  const currentPrice = livePrice?.price ?? card.currentPrice;
  const changePercent = (() => {
    if (livePrice && card.currentPrice && card.changePercent != null) {
      // Estimate previousClose from initial REST snapshot
      const prevClose = card.currentPrice / (1 + card.changePercent / 100);
      if (prevClose > 0) return ((livePrice.price - prevClose) / prevClose) * 100;
    }
    return card.changePercent;
  })();

  const color = getChangeColor(changePercent);
  const priceText = formatNumberCompact(currentPrice);
  const isLongPrice = priceText.length > 7;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, marginRight: CARD_GAP }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/stock/${encodeURIComponent(card.symbol)}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${card.label}, ${priceText}, ${formatPercent(changePercent)}`}
    >
      <Text style={styles.label} numberOfLines={1}>
        {card.label}
      </Text>
      <Text style={[styles.price, isLongPrice && styles.priceSmall]} numberOfLines={1}>
        {priceText}
      </Text>
      <Text style={[styles.change, { color }]}>{formatPercent(changePercent)}</Text>
      <View style={styles.chart} pointerEvents="none">
        {card.sparkline && card.sparkline.length >= 2 ? (
          <LineChart
            data={card.sparkline}
            width={sparklineWidth}
            height={SPARKLINE_HEIGHT}
            color={color}
            showGradient={false}
          />
        ) : (
          <View style={{ height: SPARKLINE_HEIGHT }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginBottom: 16,
  },
  card: {
    minHeight: CARD_HEIGHT,
    backgroundColor: HOME.card,
    borderRadius: HOME.radius.card,
    paddingVertical: CARD_V_PADDING,
    paddingHorizontal: CARD_H_PADDING,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
  },
  label: {
    fontSize: 10,
    color: HOME.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: HOME.textPrimary,
    marginBottom: 2,
  },
  priceSmall: { fontSize: 12 },
  change: {
    fontSize: 11,
    fontWeight: '600',
  },
  chart: {
    marginTop: 4,
    height: SPARKLINE_HEIGHT,
    overflow: 'hidden',
  },
});
