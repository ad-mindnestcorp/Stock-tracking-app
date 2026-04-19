import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { pushApi } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request notification permissions and register the Expo push token with our backend */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    await pushApi.register(token);
    return token;
  } catch (err) {
    // Network errors are expected in simulators and dev builds without internet.
    // Log a warning instead of an error so it doesn't look like a crash.
    const message = err instanceof Error ? err.message : String(err);
    const isNetworkError = message.includes('Network request failed');
    if (__DEV__ && isNetworkError) {
      console.warn('[Push] Skipped push token registration (simulator or no network)');
    } else {
      console.error('Failed to get/register push token:', err);
    }
    return null;
  }
}
