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
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);

    if (error) {
      toast.error(error.message, 'Failed to send');
    } else {
      toast.success(
        `A reset link has been sent to ${email.trim().toLowerCase()}. Check your inbox.`,
        'Email sent'
      );
      router.back();
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
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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

        <Text style={styles.heading}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your registered email below to receive password reset instruction.
        </Text>

        {/* Email input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, !!emailError && styles.inputError]}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailError) setEmailError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
        </View>

        <View style={{ height: 8 }} />

        {/* Send button */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSend}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Send</Text>
          )}
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
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 32,
    },

    inputWrap: {
      marginBottom: 8,
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
    fieldError: {
      fontSize: 12,
      color: colors.negative,
      marginTop: 4,
      marginLeft: 4,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 16,
      alignItems: 'center',
    },
    btnDisabled: {
      opacity: 0.7,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
}
