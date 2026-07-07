import AsyncStorage from '@react-native-async-storage/async-storage';

export type InvestingStyle = 'long_term' | 'swing' | 'active' | 'exploring';

export type OnboardingGoal =
  | 'trending_stocks'
  | 'momentum'
  | 'track_earnings'
  | 'market_moves'
  | 'ai_research'
  | 'monitor_portfolio';

export interface OnboardingData {
  investingStyle: InvestingStyle | null;
  goals: OnboardingGoal[];
  selectedStocks: Array<{ symbol: string; name: string }>;
}

const KEYS = {
  COMPLETE: 'vesto_onboarding_complete',
  DATA: 'vesto_onboarding_data',
  AI_FREE_USED: 'vesto_ai_free_used',
} as const;

const DEFAULT_DATA: OnboardingData = {
  investingStyle: null,
  goals: [],
  selectedStocks: [],
};

export async function getOnboardingComplete(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.COMPLETE);
  return val === 'true';
}

export async function setOnboardingComplete(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.COMPLETE, String(value));
}

export async function getOnboardingData(): Promise<OnboardingData> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DATA);
    if (!raw) return DEFAULT_DATA;
    return JSON.parse(raw) as OnboardingData;
  } catch {
    return DEFAULT_DATA;
  }
}

export async function saveOnboardingData(data: Partial<OnboardingData>): Promise<void> {
  const current = await getOnboardingData();
  const merged = { ...current, ...data };
  await AsyncStorage.setItem(KEYS.DATA, JSON.stringify(merged));
}

export async function getAIFreeUsed(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.AI_FREE_USED);
  return val === 'true';
}

export async function setAIFreeUsed(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.AI_FREE_USED, String(value));
}

export async function clearOnboarding(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.COMPLETE, KEYS.DATA, KEYS.AI_FREE_USED]);
}

export async function getPendingWatchlistSeed(): Promise<boolean> {
  const val = await AsyncStorage.getItem('vesto_pending_watchlist_seed');
  return val === 'true';
}

export async function setPendingWatchlistSeed(value: boolean): Promise<void> {
  await AsyncStorage.setItem('vesto_pending_watchlist_seed', String(value));
}
