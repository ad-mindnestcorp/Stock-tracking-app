import { useEffect } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const LOGO_SIZE = width * 0.52;

// Timeline (all offsets from t=0):
//   0ms   fade in (400ms) + spring scale 0.75→1 (500ms, well-damped)
// 520ms   arrow nudge up (120ms)
// 640ms   arrow return down (180ms)
// 820ms   hold
// 1120ms  exit: fade out + scale up (350ms)
// 1470ms  onAnimationComplete
const NUDGE_START = 520;
const EXIT_START = 1120;
const EXIT_DURATION = 350;

interface Props {
  onAnimationComplete: () => void;
}

export default function VestoSplash({ onAnimationComplete }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.75);
  const translateY = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  useEffect(() => {
    // Phase 1: entrance
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1, { damping: 22, stiffness: 180 });

    // Phase 2: arrow nudge — explicit timing, no callback chaining
    translateY.value = withDelay(
      NUDGE_START,
      withSequence(
        withTiming(-16, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200, easing: Easing.out(Easing.back(2)) })
      )
    );

    // Phase 3: exit — fires after hold; callback only here for onAnimationComplete
    containerOpacity.value = withDelay(
      EXIT_START,
      withTiming(0, { duration: EXIT_DURATION }, (finished) => {
        if (finished) runOnJS(onAnimationComplete)();
      })
    );
    containerScale.value = withDelay(
      EXIT_START,
      withTiming(1.12, { duration: EXIT_DURATION })
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, containerStyle]}>
      <Animated.View style={logoStyle}>
        <Image
          source={require("@/assets/images/V-Logo-NeonGreen-Transparent-1024.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
