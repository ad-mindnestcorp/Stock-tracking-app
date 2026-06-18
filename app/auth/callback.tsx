import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { Colors } from '@/constants/theme';

export default function AuthCallback() {
  const { session, loading } = useAuth();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // On web: Supabase already verified the email server-side before redirecting here.
    // Just show the success screen immediately.
    if (Platform.OS === 'web') {
      router.replace('/(auth)/verify-email');
      return;
    }

    // On mobile — OAuth completed: session is ready, go to app
    if (!loading && session) {
      router.replace('/(tabs)');
      return;
    }

    // On mobile — email verification types: show success screen
    if (type === 'signup' || type === 'recovery' || type === 'email_change' || type === 'invite') {
      router.replace('/(auth)/verify-email');
      return;
    }

    // Fallback for mobile: wait up to 10s for session, then show verify-email
    timeoutRef.current = setTimeout(() => {
      router.replace('/(auth)/verify-email');
    }, 10000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [session, loading, type]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}
