import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { track } from '@/lib/analytics';

const STEPS = [
  'Analyzing your investing style…',
  'Mapping your goals to market data…',
  'Curating your stock feed…',
  'Building your personalized experience…',
];

export default function PersonalizingScreen() {
  const [displayStep, setDisplayStep] = useState(STEPS[0]);
  const progress = useSharedValue(0);
  const dotOpacity1 = useSharedValue(0.3);
  const dotOpacity2 = useSharedValue(0.3);
  const dotOpacity3 = useSharedValue(0.3);

  useEffect(() => {
    track('onboarding_step_completed', { step: 'personalizing' });

    progress.value = withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) });

    const startDot = (dot: typeof dotOpacity1) => {
      dot.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 })
        ),
        -1,
        false
      );
    };
    startDot(dotOpacity1);
    setTimeout(() => startDot(dotOpacity2), 200);
    setTimeout(() => startDot(dotOpacity3), 400);

    const stepTimers = STEPS.map((step, i) =>
      setTimeout(() => setDisplayStep(step), i * 700)
    );

    const navTimer = setTimeout(() => {
      router.replace('/(onboarding)/signup');
    }, 3000);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(navTimer);
    };
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: dotOpacity1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dotOpacity2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dotOpacity3.value }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>✦</Text>
        </View>

        <Text style={styles.headline}>Building your{'\n'}personalized feed</Text>

        <Text style={styles.stepText}>{displayStep}</Text>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>

        <View style={styles.dots}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#CCFF0015',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 32, color: '#CCFF00' },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 36,
  },
  stepText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 21,
    minHeight: 21,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#CCFF00',
    borderRadius: 2,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCFF00',
  },
});
