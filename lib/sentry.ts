import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    // Capture 100% of transactions in development; tune down in production
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    // Capture replays only on errors in production
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
