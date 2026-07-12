import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/auth';
import { useFeatureTour } from '@/context/feature-tour-context';
import { CURRENT_TOUR_VERSION } from '@/context/feature-tour-context';
import { supabase } from '@/lib/supabase';

const ASYNC_KEY = `vesto_feature_tour_v${CURRENT_TOUR_VERSION}`;

/**
 * Call this inside the Home screen.
 * Checks both AsyncStorage (fast path) and Supabase user_metadata,
 * then starts the tour after a short delay so the UI can settle.
 */
export function useFeatureTourInit(isOnboardingComplete: boolean) {
  const { session } = useAuth();
  const { startTour } = useFeatureTour();
  const initiated = useRef(false);

  useEffect(() => {
    if (!session || !isOnboardingComplete || initiated.current) return;

    async function checkAndStart() {
      const localDone = await AsyncStorage.getItem(ASYNC_KEY);
      if (localDone === 'true') return;

      const meta = session!.user?.user_metadata ?? {};
      const tourDone = meta.feature_tour_completed === true;
      const tourVersion =
        typeof meta.feature_tour_version === 'number' ? meta.feature_tour_version : 0;

      if (tourDone && tourVersion >= CURRENT_TOUR_VERSION) {
        await AsyncStorage.setItem(ASYNC_KEY, 'true').catch(() => {});
        return;
      }

      initiated.current = true;
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      startTour();
    }

    checkAndStart().catch(console.error);
  }, [session, isOnboardingComplete]);
}

/**
 * Persists tour completion to both Supabase user_metadata and AsyncStorage.
 * Safe to call multiple times (both are idempotent).
 */
export async function markTourComplete(): Promise<void> {
  await Promise.allSettled([
    supabase.auth.updateUser({
      data: {
        feature_tour_completed: true,
        feature_tour_version: CURRENT_TOUR_VERSION,
      },
    }),
    AsyncStorage.setItem(ASYNC_KEY, 'true'),
  ]);
}
