/**
 * Reusable skeleton / shimmer loading components.
 * Built on react-native-reanimated (already installed) — no new dependency needed.
 *
 * Usage:
 *   <SkeletonBox width={200} height={20} />
 *   <SkeletonCircle size={44} />
 *   <SkeletonStockRow />
 *   <SkeletonAlertCard />
 */

import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';

function usePulse() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800 }),
      -1,
      true
    );
  }, [opacity]);

  return useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0.4, 1], [0.4, 1], Extrapolation.CLAMP),
  }));
}

interface BoxProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width, height = 16, borderRadius = Radius.sm, style }: BoxProps) {
  const { colors } = useTheme();
  const animStyle = usePulse();

  return (
    <Animated.View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius,
          backgroundColor: colors.surface,
        },
        animStyle,
        style,
      ]}
    />
  );
}

interface CircleProps {
  size?: number;
  style?: ViewStyle;
}

export function SkeletonCircle({ size = 44, style }: CircleProps) {
  return <SkeletonBox width={size} height={size} borderRadius={size / 2} style={style} />;
}

/** One row in a stock list (icon + two text lines + price block) */
export function SkeletonStockRow() {
  return (
    <View style={skeletonStyles.row}>
      <SkeletonCircle size={44} />
      <View style={skeletonStyles.rowBody}>
        <SkeletonBox width="40%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBox width="60%" height={11} />
      </View>
      <View style={skeletonStyles.rowRight}>
        <SkeletonBox width={60} height={14} style={{ marginBottom: 6 }} />
        <SkeletonBox width={44} height={11} />
      </View>
    </View>
  );
}

/** A card-shaped alert skeleton */
export function SkeletonAlertCard() {
  const { colors } = useTheme();
  return (
    <View style={[skeletonStyles.card, { backgroundColor: colors.cardBg }]}>
      <View style={skeletonStyles.cardTop}>
        <SkeletonBox width={60} height={20} borderRadius={Radius.full} />
        <SkeletonBox width={80} height={14} />
        <SkeletonBox width={40} height={11} />
      </View>
      <SkeletonBox width="90%" height={13} style={{ marginTop: 8 }} />
      <SkeletonBox width="60%" height={13} style={{ marginTop: 4 }} />
    </View>
  );
}

/** A full home screen skeleton  */
export function SkeletonHomeScreen() {
  return (
    <View style={skeletonStyles.page}>
      {/* Market summary card */}
      <SkeletonBox height={120} borderRadius={Radius.lg} style={{ marginBottom: 16 }} />
      {/* Tab pills */}
      <View style={skeletonStyles.tabRow}>
        {[80, 90, 80, 100].map((w, i) => (
          <SkeletonBox key={i} width={w} height={32} borderRadius={Radius.full} />
        ))}
      </View>
      {/* Stock rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonStockRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonListScreen({ count = 5 }: { count?: number }) {
  return (
    <View style={skeletonStyles.page}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStockRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonAlertListScreen({ count = 4 }: { count?: number }) {
  return (
    <View style={skeletonStyles.page}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonAlertCard key={i} />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  card: {
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
