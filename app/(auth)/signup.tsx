import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { signupSchema, type SignupFormValues } from '@/lib/schemas';
import { toast } from '@/lib/toast';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    const redirectUrl = Linking.createURL('auth/callback');

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message, 'Sign up failed');
    } else if (authData.session) {
      // Email confirmation is disabled in Supabase — user is immediately signed in.
      // onAuthStateChange in AuthProvider will update session and layout guards
      // will redirect to /(tabs) automatically.
      toast.success('Welcome! Your account has been created.', 'Account created');
    } else {
      // Email confirmation is enabled — user must verify before logging in.
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
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token ?? '',
            });
            if (sessionError) throw sessionError;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      toast.error(message, 'Google sign-in error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <Ionicons name="bar-chart" size={20} color={colors.textPrimary} />
            <Text style={styles.logoText}>
              Stockve<Text style={styles.logoHighlight}>st</Text>
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.heading}>Sign Up</Text>

        {/* Email */}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              {errors.email && <Text style={styles.fieldError}>{errors.email.message}</Text>}
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
                placeholderTextColor={colors.textMuted}
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
                  color={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
                  color={colors.textMuted}
                />
              </TouchableOpacity>
              {errors.confirmPassword && (
                <Text style={styles.fieldError}>{errors.confirmPassword.message}</Text>
              )}
            </View>
          )}
        />

        <View style={{ height: 24 }} />

        {/* Sign up button */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit(onSignup)}
          disabled={loading || googleLoading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Registration</Text>
          )}
        </TouchableOpacity>

        {/* Google OAuth button */}
        <TouchableOpacity
          style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading || googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <GoogleIcon />
              <Text style={styles.googleBtnText}>With Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.dividerText}>Already have an account?</Text>

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.outlineBtnText}>Login</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <View style={googleIconStyles.container}>
      <Text style={[googleIconStyles.letter, { color: '#4285F4' }]}>G</Text>
    </View>
  );
}

const googleIconStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  letter: {
    fontSize: 14,
    fontWeight: '700',
  },
});

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 40,
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 36,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logoText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    logoHighlight: {
      backgroundColor: colors.primary,
      color: colors.onPrimary,
      borderRadius: 4,
      overflow: 'hidden',
    },

    heading: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 32,
    },

    inputWrap: {
      marginBottom: 16,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: Radius.full,
      paddingHorizontal: 20,
      paddingVertical: Platform.OS === 'ios' ? 16 : 14,
      fontSize: 15,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    inputError: {
      borderColor: colors.negative,
    },
    inputWithIcon: {
      paddingRight: 52,
    },
    eyeBtn: {
      position: 'absolute',
      right: 18,
      top: Platform.OS === 'ios' ? 16 : 14,
      justifyContent: 'center',
    },
    fieldError: {
      fontSize: 12,
      color: colors.negative,
      marginTop: 4,
      marginLeft: 4,
    },
    hint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
      marginLeft: 4,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 14,
    },
    btnDisabled: {
      opacity: 0.7,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimary,
    },

    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 15,
      marginBottom: 20,
    },
    googleBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    dividerText: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 12,
    },

    outlineBtn: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 15,
      alignItems: 'center',
    },
    outlineBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
}
