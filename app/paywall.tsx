import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '@/context/subscription-context';
import { toast } from '@/lib/toast';
import { track } from '@/lib/analytics';

const BENEFITS = [
  { icon: 'sparkles-outline' as const, title: 'Unlimited AI Research', desc: 'Generate institutional-grade reports for any stock, anytime.' },
  { icon: 'trending-up-outline' as const, title: 'Advanced Momentum Signals', desc: 'RSI, moving averages, and support/resistance levels.' },
  { icon: 'notifications-outline' as const, title: 'Smart Price Alerts', desc: '52-week high/low and custom price alerts.' },
  { icon: 'bar-chart-outline' as const, title: 'Full Market Insights', desc: 'Earnings calendar, sector heatmaps, and unusual volume.' },
  { icon: 'shield-checkmark-outline' as const, title: 'Priority Data', desc: 'Faster data refreshes and priority API access.' },
];

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://vesto.app/privacy';

export default function PaywallScreen() {
  const { offerings, isLoading, purchase, restore } = useSubscription();
  const params = useLocalSearchParams<{ trigger?: string }>();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    track('paywall_viewed', { trigger_feature: params.trigger ?? 'ai_research' });
  }, []);

  const monthly = offerings?.monthly;
  const annual = offerings?.annual;

  const selectedPackage = selectedPlan === 'annual' ? annual : monthly;

  const handlePurchase = async () => {
    if (!selectedPackage) {
      toast.error('Plans are not available right now. Please try again later.', 'Unavailable');
      return;
    }
    setPurchasing(true);
    try {
      const success = await purchase(selectedPackage.identifier);
      if (success) {
        track('subscription_started', { plan_type: selectedPlan });
        toast.success('Welcome to Vesto Premium!', 'Subscribed');
        router.back();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Purchase failed. Please try again.';
      toast.error(message, 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await restore();
      if (success) {
        track('subscription_restored');
        toast.success('Your subscription has been restored.', 'Restored');
        router.back();
      } else {
        toast.error('No active subscription found for this account.', 'Nothing to restore');
      }
    } finally {
      setRestoring(false);
    }
  };

  const annualSavings = (() => {
    if (!monthly || !annual) return null;
    const monthlyPrice = parseFloat(monthly.price.replace(/[^0-9.]/g, ''));
    const annualPrice = parseFloat(annual.price.replace(/[^0-9.]/g, ''));
    if (!monthlyPrice || !annualPrice) return null;
    const annualMonthly = annualPrice / 12;
    const pct = Math.round(((monthlyPrice - annualMonthly) / monthlyPrice) * 100);
    return pct > 0 ? pct : null;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Close */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#888888" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles" size={28} color="#CCFF00" />
            </View>
            <Text style={styles.heroTitle}>Vesto Premium</Text>
            <Text style={styles.heroSubtitle}>
              Unlock unlimited AI research and advanced market tools.
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={18} color="#CCFF00" />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Plan selector */}
          {isLoading ? (
            <View style={styles.plansLoading}>
              <ActivityIndicator color="#CCFF00" />
              <Text style={styles.plansLoadingText}>Loading plans…</Text>
            </View>
          ) : (
            <View style={styles.plans}>
              {/* Annual */}
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.85}
              >
                <View style={styles.planCardHeader}>
                  <View style={styles.planCardLeft}>
                    <Text style={[styles.planName, selectedPlan === 'annual' && styles.planNameSelected]}>
                      Annual
                    </Text>
                    {annualSavings && (
                      <View style={styles.savingsBadge}>
                        <Text style={styles.savingsBadgeText}>Save {annualSavings}%</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.radio, selectedPlan === 'annual' && styles.radioSelected]}>
                    {selectedPlan === 'annual' && <View style={styles.radioDot} />}
                  </View>
                </View>
                <Text style={styles.planPrice}>
                  {annual ? annual.price : '—'}
                  <Text style={styles.planPeriod}> / year</Text>
                </Text>
                {annual && (
                  <Text style={styles.planPerMonth}>
                    {`${annual.price.replace(/\d+(\.\d+)?/, (n) =>
                      (parseFloat(n) / 12).toFixed(2)
                    )} / month`}
                  </Text>
                )}
                {annual?.prialPeriod && (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialText}>Free trial available</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Monthly */}
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.85}
              >
                <View style={styles.planCardHeader}>
                  <Text style={[styles.planName, selectedPlan === 'monthly' && styles.planNameSelected]}>
                    Monthly
                  </Text>
                  <View style={[styles.radio, selectedPlan === 'monthly' && styles.radioSelected]}>
                    {selectedPlan === 'monthly' && <View style={styles.radioDot} />}
                  </View>
                </View>
                <Text style={styles.planPrice}>
                  {monthly ? monthly.price : '—'}
                  <Text style={styles.planPeriod}> / month</Text>
                </Text>
                {monthly?.prialPeriod && (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialText}>Free trial available</Text>
                  </View>
                )}
              </TouchableOpacity>

              {!monthly && !annual && (
                <View style={styles.unavailableCard}>
                  <Ionicons name="information-circle-outline" size={18} color="#888888" />
                  <Text style={styles.unavailableText}>
                    Subscription plans are not available in your region right now.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.subscribeBtn, (!selectedPackage || purchasing) && styles.subscribeBtnDisabled]}
            onPress={handlePurchase}
            disabled={!selectedPackage || purchasing || isLoading}
            activeOpacity={0.85}
          >
            {purchasing ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.subscribeBtnText}>
                {selectedPackage ? 'Start Premium' : 'Unavailable'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring || purchasing}
            activeOpacity={0.7}
          >
            {restoring ? (
              <ActivityIndicator size="small" color="#888888" />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          {Platform.OS === 'ios' && (
            <Text style={styles.legalDisclosure}>
              Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },

  hero: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#CCFF0018',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  heroSubtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  benefitsSection: { gap: 14, marginBottom: 24 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#CCFF0015',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  benefitDesc: { fontSize: 12, color: '#888888', lineHeight: 18 },

  plansLoading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  plansLoadingText: { fontSize: 13, color: '#888888' },
  plans: { gap: 12, marginBottom: 8 },

  planCard: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 6,
  },
  planCardSelected: {
    borderColor: '#CCFF00',
    backgroundColor: '#1a1f0a',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  planCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  planNameSelected: { color: '#CCFF00' },
  savingsBadge: {
    backgroundColor: '#CCFF0020',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  savingsBadgeText: { fontSize: 11, fontWeight: '700', color: '#CCFF00' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#CCFF00' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CCFF00',
  },
  planPrice: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  planPeriod: { fontSize: 14, fontWeight: '400', color: '#888888' },
  planPerMonth: { fontSize: 12, color: '#888888' },
  trialBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#26d98e20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trialText: { fontSize: 11, fontWeight: '600', color: '#26d98e' },

  unavailableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  unavailableText: { flex: 1, fontSize: 13, color: '#888888', lineHeight: 18 },

  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  subscribeBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
  },
  subscribeBtnDisabled: { opacity: 0.4 },
  subscribeBtnText: { fontSize: 16, fontWeight: '800', color: '#0a0a0a' },

  restoreBtn: { alignItems: 'center', paddingVertical: 6 },
  restoreText: { fontSize: 14, color: '#888888', fontWeight: '500' },

  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legalLink: { fontSize: 12, color: '#555555', textDecorationLine: 'underline' },
  legalSep: { fontSize: 12, color: '#444444' },
  legalDisclosure: {
    fontSize: 10,
    color: '#444444',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4,
  },
});
