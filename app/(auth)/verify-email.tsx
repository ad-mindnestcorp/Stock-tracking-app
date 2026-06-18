import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTheme } from '@/context/theme-context';
import { Radius } from '@/constants/theme';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={80} color={colors.positive} />
          </View>

          {/* Header */}
          <Text style={styles.heading}>Email Verified!</Text>

          {/* Description */}
          <Text style={styles.description}>
            Your email has been successfully verified. You can now log in to your Vesto account with your credentials.
          </Text>

          {/* On web: show "Open App" button; on mobile: show "Go to Login" */}
          {isWeb ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => Linking.openURL('stocktrackingapp://')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Open Vesto App</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Go to Login</Text>
            </TouchableOpacity>
          )}

          {/* Note */}
          <Text style={styles.note}>
            {isWeb
              ? "Your email is verified. Open the Vesto app on your phone and log in."
              : "If you didn't verify this email, you can safely ignore this message."}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    content: {
      alignItems: 'center',
      width: '100%',
    },
    iconContainer: {
      marginBottom: 32,
    },
    heading: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.full,
      paddingVertical: 16,
      alignItems: 'center',
      width: '100%',
      marginBottom: 24,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    note: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
