import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { track } from '@/lib/analytics';

export default function ValuePropositionScreen() {
  useEffect(() => {
    track('onboarding_started');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Brand */}
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/V-Logo-NeonGreen-Transparent-1024.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Vesto</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/V-Logo-NeonGreen-Transparent-1024.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </View>

        {/* Copy */}
        <View style={styles.copy}>
          <Text style={styles.headline}>Invest with{'\n'}more clarity.</Text>
          <Text style={styles.subtitle}>
            Get a personalized market feed built around your investing style, goals, and the stocks you follow.
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              track('onboarding_step_completed', { step: 'value_proposition' });
              router.push('/(onboarding)/investing-style');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Build My Market Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>
              Already have an account?{' '}
              <Text style={styles.secondaryBtnHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  brandLogo: { width: 32, height: 32 },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#CCFF00',
    letterSpacing: 0.5,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: { width: 180, height: 180 },
  copy: { marginBottom: 40 },
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 44,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: '#888888',
    lineHeight: 23,
  },
  cta: { gap: 12, marginBottom: 8 },
  primaryBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: { fontSize: 14, color: '#888888' },
  secondaryBtnHighlight: { color: '#CCFF00', fontWeight: '700' },
});
