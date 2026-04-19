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
import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loginSchema, type LoginFormValues } from '@/lib/schemas';
import { toast } from '@/lib/toast';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onLogin = async (data: LoginFormValues) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message, 'Login failed');
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues('email').trim();
    if (!email) {
      toast.info('Enter your email above, then tap Forgot Password.', 'Email required');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase());
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`A reset link has been sent to ${email}.`, 'Check your inbox');
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
        {/* Logo */}
        <View style={styles.logoRow}>
          <Ionicons name="bar-chart" size={20} color={colors.textPrimary} />
          <Text style={styles.logoText}>
            Stockve<Text style={styles.logoHighlight}>st</Text>
          </Text>
        </View>

        <Text style={styles.heading}>Login</Text>

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
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit(onLogin)}
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
              {errors.password && (
                <Text style={styles.fieldError}>{errors.password.message}</Text>
              )}
            </View>
          )}
        />

        {/* Forgot password */}
        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login button */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit(onLogin)}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Login</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.dividerText}>Don't have an account?</Text>

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => router.push('/(auth)/signup')}
          activeOpacity={0.85}
        >
          <Text style={styles.outlineBtnText}>Registration</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 64,
      paddingBottom: 40,
    },

    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 48,
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
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    fieldError: {
      fontSize: 12,
      color: colors.negative,
      marginTop: 4,
      marginLeft: 4,
    },

    forgotBtn: {
      alignSelf: 'flex-end',
      marginBottom: 24,
      marginTop: -4,
    },
    forgotText: {
      fontSize: 14,
      color: colors.negative,
      fontWeight: '600',
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 20,
    },
    btnDisabled: {
      opacity: 0.7,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimary,
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
