import VestoSplash from "@/components/VestoSplash";
import { useAuth } from "@/context/auth";
import { useOnboarding } from "@/context/onboarding-context";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EntryScreen() {
  const { session } = useAuth();
  const { isComplete, isLoaded } = useOnboarding();
  const [splashDone, setSplashDone] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const onboardingRef = useRef({ isComplete, isLoaded });
  onboardingRef.current = { isComplete, isLoaded };

  const logoScale = useSharedValue(0.72);
  const contentOpacity = useSharedValue(0);

  const handleSplashComplete = useCallback(() => {
    if (sessionRef.current) {
      router.replace("/(tabs)");
      return;
    }

    // Wait for onboarding state to load before routing
    const route = () => {
      const { isComplete: complete } = onboardingRef.current;
      if (complete) {
        // Onboarding done, just needs to sign in/up
        router.replace("/(onboarding)/signup");
      } else {
        // Show landing with CTA to start onboarding
        logoScale.value = withTiming(1, {
          duration: 700,
          easing: Easing.out(Easing.cubic),
        });
        contentOpacity.value = withDelay(
          150,
          withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
        );
        setSplashDone(true);
      }
    };

    if (onboardingRef.current.isLoaded) {
      route();
    } else {
      const check = setInterval(() => {
        if (onboardingRef.current.isLoaded) {
          clearInterval(check);
          route();
        }
      }, 50);
    }
  }, []);

  const heroLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <View style={styles.root}>
      {/* Landing screen — always rendered beneath the splash overlay */}
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Brand row fades in with other content */}
        <Animated.View style={[styles.brandRow, contentStyle]}>
          <Image
            source={require("@/assets/images/V-Logo-NeonGreen-Transparent-1024.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Vesto</Text>
        </Animated.View>

        {/* Hero logo scales up */}
        <View style={styles.hero}>
          <Animated.Image
            source={require("@/assets/images/V-Logo-NeonGreen-Transparent-1024.png")}
            style={[styles.heroLogo, heroLogoStyle]}
            resizeMode="contain"
          />
        </View>

        {/* Text + buttons fade in */}
        <Animated.View style={contentStyle}>
          <View style={styles.copyBlock}>
            <Text style={styles.headline}>
              Invest with{"\n"}more clarity.
            </Text>
            <Text style={styles.subtitle}>
              Get a personalized market feed built around your investing style, goals, and the stocks you follow.
            </Text>
          </View>

          <View style={styles.ctaBlock}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/(onboarding)")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Build My Market Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/(auth)/login")}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>
                Already have an account?{" "}
                <Text style={styles.secondaryBtnHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* Splash overlay — unmounted after animation so it doesn't block touches */}
      {!splashDone && (
        <VestoSplash onAnimationComplete={handleSplashComplete} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 28,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#CCFF00",
    letterSpacing: 0.5,
  },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogo: {
    width: 180,
    height: 180,
  },

  copyBlock: {
    marginBottom: 40,
  },
  headline: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 40,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: "#888888",
    lineHeight: 22,
  },

  ctaBlock: {
    gap: 12,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: "#CCFF00",
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0a0a0a",
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
    color: "#888888",
  },
  secondaryBtnHighlight: {
    color: "#CCFF00",
    fontWeight: "700",
  },
});
