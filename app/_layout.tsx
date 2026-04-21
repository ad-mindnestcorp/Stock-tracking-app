import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import Toast from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/context/auth';
import { ThemeProvider, useTheme } from '@/context/theme-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { queryClient } from '@/lib/query-client';
import { initSentry, Sentry } from '@/lib/sentry';
import { initI18n } from '@/lib/i18n';
import { initAnalytics } from '@/lib/analytics';

// Initialise once before the component tree mounts
initSentry();
initI18n();
initAnalytics().catch(console.error);

function useOAuthDeepLink() {
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url.includes('auth/callback')) return;

      // Email confirmation (type=signup) and password recovery (type=recovery):
      // Supabase sends token_hash + type in the link query params.
      const tokenHashMatch = url.match(/[?&]token_hash=([^&]+)/);
      const typeMatch = url.match(/[?&]type=([^&#]+)/);
      if (tokenHashMatch?.[1] && typeMatch?.[1]) {
        supabase.auth
          .verifyOtp({
            token_hash: decodeURIComponent(tokenHashMatch[1]),
            type: decodeURIComponent(typeMatch[1]) as 'signup' | 'recovery' | 'email' | 'invite' | 'magiclink' | 'email_change',
          })
          .catch(console.error);
        return;
      }

      // PKCE: extract ?code= from query params (used by Google OAuth and some email flows)
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (codeMatch?.[1]) {
        supabase.auth
          .exchangeCodeForSession(decodeURIComponent(codeMatch[1]))
          .catch(console.error);
        return;
      }

      // Implicit flow fallback: extract tokens from URL fragment
      const fragment = url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token) {
        supabase.auth
          .setSession({ access_token, refresh_token: refresh_token ?? '' })
          .catch(console.error);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, []);
}

function RootLayout() {
  useOAuthDeepLink();
  const { isDark } = useTheme();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="stock/[symbol]"
          options={{ headerShown: false, presentation: 'card' }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Toast />
    </>
  );
}

function App() {
  useEffect(() => {
    registerForPushNotifications().catch(console.error);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootLayout />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Wrap the root with Sentry's error boundary so crashes are reported automatically
export default Sentry.wrap(App);
