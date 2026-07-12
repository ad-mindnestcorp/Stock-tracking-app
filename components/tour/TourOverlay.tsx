import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  TOUR_STEPS,
  type TourStepLayout,
  useFeatureTour,
} from '@/context/feature-tour-context';
import { markTourComplete } from '@/hooks/use-feature-tour-init';

// ─── helpers ─────────────────────────────────────────────────────────────────

function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const cr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + cr} ${y}`,
    `H ${x + w - cr}`,
    `Q ${x + w} ${y} ${x + w} ${y + cr}`,
    `V ${y + h - cr}`,
    `Q ${x + w} ${y + h} ${x + w - cr} ${y + h}`,
    `H ${x + cr}`,
    `Q ${x} ${y + h} ${x} ${y + h - cr}`,
    `V ${y + cr}`,
    `Q ${x} ${y} ${x + cr} ${y}`,
    'Z',
  ].join(' ');
}

function buildSpotlightPath(
  W: number,
  H: number,
  layout: TourStepLayout,
  radius: number,
): string {
  const outer = `M 0 0 H ${W} V ${H} H 0 Z`;
  const inner = roundedRectPath(layout.x, layout.y, layout.width, layout.height, radius);
  return `${outer} ${inner}`;
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.80)';
const ACCENT = '#CCFF00';
const SPOTLIGHT_RADIUS = 14;
const TOOLTIP_GAP = 14;
const TOOLTIP_H_PAD = 16;
const TAB_BAR_HEIGHT = 56;

// ─── glow ring ────────────────────────────────────────────────────────────────

function GlowRing({ layout, stepKey }: { layout: TourStepLayout; stepKey: string }) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    scale.value = 1;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 850, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 950, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glowRing,
        {
          left: layout.x - 4,
          top: layout.y - 4,
          width: layout.width + 8,
          height: layout.height + 8,
          borderRadius: SPOTLIGHT_RADIUS + 4,
        },
        animStyle,
      ]}
    />
  );
}

// ─── completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ onDismiss }: { onDismiss: () => void }) {
  const fadeIn = useSharedValue(0);
  const scale = useSharedValue(0.88);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 380 });
    scale.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.back(1.4)),
    });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.completionBg}>
      <Animated.View style={[styles.completionCard, containerStyle]}>
        <View style={styles.completionIconWrap}>
          <Text style={styles.completionIcon}>✦</Text>
        </View>
        <Text style={styles.completionTitle}>{"You're ready to\nexplore Vesto."}</Text>
        <Text style={styles.completionSub}>
          Your personalised feed is set up. Dive in whenever you're ready.
        </Text>
        <TouchableOpacity style={styles.completionBtn} activeOpacity={0.85} onPress={onDismiss}>
          <Text style={styles.completionBtnText}>Start Exploring →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── main overlay ─────────────────────────────────────────────────────────────

export function TourOverlay() {
  const {
    isActive,
    isCompleting,
    currentStep,
    currentStepIndex,
    stepLayout,
    nextStep,
    skipTour,
    dismissCompletion,
  } = useFeatureTour();

  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // For the tab_bar step there's no TourTarget — compute it from screen geometry.
  const [tabBarLayout, setTabBarLayout] = useState<TourStepLayout | null>(null);

  useEffect(() => {
    if (isActive && currentStep?.id === 'tab_bar' && !stepLayout) {
      const tabH = TAB_BAR_HEIGHT + insets.bottom;
      setTabBarLayout({
        x: 0,
        y: screenH - tabH,
        width: screenW,
        height: tabH,
      });
    } else {
      setTabBarLayout(null);
    }
  }, [isActive, currentStep?.id, stepLayout, screenH, insets.bottom, screenW]);

  const effectiveLayout = stepLayout ?? tabBarLayout;

  // Tooltip position — auto: above spotlight if it's in the lower half of screen.
  const TOOLTIP_MAX_W = screenW - TOOLTIP_H_PAD * 2;
  let tooltipStyle: object = {};

  if (effectiveLayout) {
    const spotCenterY = effectiveLayout.y + effectiveLayout.height / 2;
    if (spotCenterY > screenH * 0.52) {
      tooltipStyle = {
        bottom: screenH - effectiveLayout.y + TOOLTIP_GAP,
        left: TOOLTIP_H_PAD,
        width: TOOLTIP_MAX_W,
      };
    } else {
      tooltipStyle = {
        top: effectiveLayout.y + effectiveLayout.height + TOOLTIP_GAP,
        left: TOOLTIP_H_PAD,
        width: TOOLTIP_MAX_W,
      };
    }
  }

  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const handleSkip = () => {
    skipTour();
    markTourComplete().catch(console.error);
  };

  const handleNext = () => {
    nextStep();
  };

  const handleDismissCompletion = () => {
    markTourComplete().catch(console.error);
    dismissCompletion();
  };

  const visible = isActive || isCompleting;
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      {isCompleting ? (
        <CompletionScreen onDismiss={handleDismissCompletion} />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          {/* ── dark overlay with spotlight hole ── */}
          {effectiveLayout ? (
            <Svg
              width={screenW}
              height={screenH}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Path
                d={buildSpotlightPath(screenW, screenH, effectiveLayout, SPOTLIGHT_RADIUS)}
                fill={OVERLAY_COLOR}
                fillRule="evenodd"
              />
            </Svg>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.fullOverlay]} />
          )}

          {/* ── glow ring ── */}
          {effectiveLayout && (
            <GlowRing layout={effectiveLayout} stepKey={currentStep?.id ?? ''} />
          )}

          {/* ── tapping the spotlight advances the tour ── */}
          {effectiveLayout && (
            <Pressable
              style={{
                position: 'absolute',
                left: effectiveLayout.x,
                top: effectiveLayout.y,
                width: effectiveLayout.width,
                height: effectiveLayout.height,
              }}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel="Advance tour"
            />
          )}

          {/* ── tooltip card ── */}
          {effectiveLayout && currentStep && (
            <View style={[styles.tooltip, tooltipStyle]}>
              <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
              <Text style={styles.tooltipDesc}>{currentStep.description}</Text>

              <View style={styles.tooltipFooter}>
                <TouchableOpacity hitSlop={10} onPress={handleSkip} accessibilityRole="button">
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>

                <View style={styles.dots}>
                  {TOUR_STEPS.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === currentStepIndex && styles.dotActive]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.nextBtn}
                  activeOpacity={0.8}
                  onPress={handleNext}
                  accessibilityRole="button"
                >
                  <Text style={styles.nextBtnText}>{isLastStep ? 'Done ✓' : 'Next →'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullOverlay: {
    backgroundColor: OVERLAY_COLOR,
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: ACCENT,
  },

  // Tooltip
  tooltip: {
    position: 'absolute',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  tooltipDesc: {
    fontSize: 13,
    color: '#aaaaaa',
    lineHeight: 19,
    marginBottom: 16,
  },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3a3a3a',
  },
  dotActive: {
    backgroundColor: ACCENT,
    width: 18,
    borderRadius: 3,
  },
  nextBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a0a0a',
  },

  // Completion screen
  completionBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  completionCard: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 24,
  },
  completionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#CCFF0015',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  completionIcon: {
    fontSize: 28,
    color: ACCENT,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  completionSub: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  completionBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 50,
    width: '100%',
    alignItems: 'center',
  },
  completionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
