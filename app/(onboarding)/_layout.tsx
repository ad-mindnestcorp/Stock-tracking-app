import { Stack, Redirect } from 'expo-router';
import { useOnboarding } from '@/context/onboarding-context';
import { useAuth } from '@/context/auth';
import { View, ActivityIndicator } from 'react-native';

export default function OnboardingLayout() {
  const { isComplete, isLoaded } = useOnboarding();
  const { session } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#CCFF00" />
      </View>
    );
  }

  // If onboarding is done and user is signed in, skip to app
  if (isComplete && session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
