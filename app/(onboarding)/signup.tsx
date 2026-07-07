import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { signupSchema, type SignupFormValues } from '@/lib/schemas';
import { toast } from '@/lib/toast';
import { useOnboarding } from '@/context/onboarding-context';
import { watchlistApi } from '@/lib/api';
import { setPendingWatchlistSeed } from '@/lib/onboarding-storage';
import { track } from '@/lib/analytics';

WebBrowser.maybeCompleteAuthSession();

async function seedWatchlist(stocks: Array<{ symbol: string; name: string }>) {
  for (const stock of stocks) {
    try {
      await watchlistApi.add(stock.symbol, stock.name);
    } catch {
      // Best-effort; don't block navigation if one fails
    }
  }
}

export default function OnboardingSignupScreen() {
  const { data: onboardingData, markComplete } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSignup = async (data: SignupFormValues) => {
    setLoading(true);
    const redirectUrl = 'https://confirmationvesto.netlify.app/auth/callback';

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message, 'Sign up failed');
      return;
    }

    track('sign_up', { source: 'onboarding' });

    if (authData.session) {
      await markComplete();
      await seedWatchlist(onboardingData.selectedStocks);
      track('onboarding_completed', {
        investing_style: onboardingData.investingStyle,
        goals: onboardingData.goals,
        stocks_count: onboardingData.selectedStocks.length,
      });
      toast.success('Your personalized feed is ready!', 'Welcome to Vesto');
      router.replace('/(tabs)');
    } else {
      await markComplete();
      await setPendingWatchlistSeed(true);
      router.replace('/(auth)/login');
      toast.success('A confirmation link has been sent — please verify before logging in.', 'Check your inbox');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned from Supabase.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success') {
        const url = result.url;
        const codeMatch = url.match(/[?&]code=([^&]+)/);
        if (codeMatch?.[1]) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            decodeURIComponent(codeMatch[1])
          );
          if (exchangeError) throw exchangeError;
        } else {
          const fragment = url.split('#')[1] ?? '';
          const params = new URLSearchParams(fragment);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token ?? '',
            });
          }
        }
        await markComplete();
        await seedWatchlist(onboardingData.selectedStocks);
        track('onboarding_completed', {
          investing_style: onboardingData.investingStyle,
          goals: onboardingData.goals,
          stocks_count: onboardingData.selectedStocks.length,
          method: 'google',
        });
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      toast.error(message, 'Sign-in error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <View style={{ width: 24 }} />
          </View>

          {/* Summary of selections */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Text style={styles.summaryIconText}>✦</Text>
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>Your feed is ready</Text>
              <Text style={styles.summaryDesc}>
                {onboardingData.selectedStocks.length} stocks •{' '}
                {onboardingData.goals.length} goal{onboardingData.goals.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          </View>

          <Text style={styles.headline}>Save your{'\n'}personalized feed</Text>
          <Text style={styles.subtitle}>
            Create an account to unlock your feed and start exploring.
          </Text>

          {/* Email */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Email"
                  placeholderTextColor="#555555"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                {errors.email && (
                  <Text style={styles.fieldError}>{errors.email.message}</Text>
                )}
              </View>
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon, errors.password && styles.inputError]}
                  placeholder="Password"
                  placeholderTextColor="#555555"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#555555"
                  />
                </TouchableOpacity>
                {errors.password ? (
                  <Text style={styles.fieldError}>{errors.password.message}</Text>
                ) : (
                  <Text style={styles.hint}>Minimum 6 characters</Text>
                )}
              </View>
            )}
          />

          {/* Confirm Password */}
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon, errors.confirmPassword && styles.inputError]}
                  placeholder="Confirm Password"
                  placeholderTextColor="#555555"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSignup)}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#555555"
                  />
                </TouchableOpacity>
                {errors.confirmPassword && (
                  <Text style={styles.fieldError}>{errors.confirmPassword.message}</Text>
                )}
              </View>
            )}
          />

          <View style={{ height: 20 }} />

          {/* Sign up */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleSubmit(onSignup)}
            disabled={loading || googleLoading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Account & Save Feed</Text>
            )}
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.divider}>Already have an account?</Text>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.outlineBtnText}>Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFF0015',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#CCFF0040',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#CCFF0030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconText: { fontSize: 18, color: '#CCFF00' },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#CCFF00', marginBottom: 3 },
  summaryDesc: { fontSize: 12, color: '#888888' },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 21,
    marginBottom: 28,
  },
  inputWrap: { marginBottom: 16 },
  input: {
    backgroundColor: '#161616',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputError: { borderColor: '#ff4d4d' },
  inputWithIcon: { paddingRight: 52 },
  eyeBtn: {
    position: 'absolute',
    right: 18,
    top: Platform.OS === 'ios' ? 16 : 14,
  },
  fieldError: { fontSize: 12, color: '#ff4d4d', marginTop: 4, marginLeft: 4 },
  hint: { fontSize: 12, color: '#555555', marginTop: 6, marginLeft: 4 },
  primaryBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#0a0a0a' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 50,
    paddingVertical: 15,
    marginBottom: 20,
    gap: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: { fontSize: 13, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  divider: {
    textAlign: 'center',
    color: '#555555',
    fontSize: 14,
    marginBottom: 12,
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
