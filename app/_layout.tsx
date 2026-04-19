import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/context/auth';
import { ErrorBoundary } from '@/components/error-boundary';

function useOAuthDeepLink() {
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url.includes('auth/callback')) return;

      // PKCE: extract ?code= from query params
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

    // Handle the case where the app was opened via deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, []);
}

function RootLayout() {
  useOAuthDeepLink();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="stock/[symbol]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function App() {
  useEffect(() => {
    registerForPushNotifications().catch(console.error);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootLayout />
      </AuthProvider>
    </ErrorBoundary>
  );
}
