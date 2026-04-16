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
  Alert,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Colors, Radius } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
    } else {
      Alert.alert(
        'Verify your email',
        'A confirmation link has been sent to your email. Please verify your account before logging in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned from Supabase.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success') {
        const url = result.url;

        // PKCE flow: extract ?code= from query params
        const codeMatch = url.match(/[?&]code=([^&]+)/);
        if (codeMatch?.[1]) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            decodeURIComponent(codeMatch[1])
          );
          if (exchangeError) throw exchangeError;
        } else {
          // Implicit flow fallback: extract tokens from URL fragment
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
      Alert.alert('Google sign-in error', message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
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
            <Ionicons name="chevron-back" size={24} color={Colors.dark} />
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <Ionicons name="bar-chart" size={20} color={Colors.dark} />
            <Text style={styles.logoText}>
              Stockve<Text style={styles.logoHighlight}>st</Text>
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.heading}>Sign Up</Text>

        {/* Email */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <View>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
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
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Minimum 6 characters with numbers</Text>
        </View>

        {/* Confirm Password */}
        <View style={{ marginTop: 8 }}>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Confirm Password"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirm((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Minimum 6 characters with numbers</Text>
        </View>

        <View style={{ height: 24 }} />

        {/* Registration button */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={loading || googleLoading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark} />
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
            <ActivityIndicator color={Colors.dark} />
          ) : (
            <>
              <GoogleIcon />
              <Text style={styles.googleBtnText}>With Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <Text style={styles.dividerText}>Already have an account?</Text>

        {/* Login button */}
        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.outlineBtnText}>Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
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
    color: Colors.dark,
  },
  logoHighlight: {
    backgroundColor: Colors.primary,
    color: Colors.dark,
    borderRadius: 4,
    overflow: 'hidden',
  },

  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark,
    textAlign: 'center',
    marginBottom: 32,
  },

  inputWrap: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputWithIcon: {
    paddingRight: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: 18,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    marginLeft: 4,
    marginBottom: 4,
  },

  primaryBtn: {
    backgroundColor: Colors.primary,
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
    color: Colors.dark,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 15,
    marginBottom: 20,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark,
  },

  dividerText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 12,
  },

  outlineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 15,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark,
  },
});
