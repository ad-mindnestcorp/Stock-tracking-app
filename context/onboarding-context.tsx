import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  getOnboardingData,
  getOnboardingComplete,
  saveOnboardingData,
  setOnboardingComplete,
  type OnboardingData,
  type InvestingStyle,
  type OnboardingGoal,
} from '@/lib/onboarding-storage';

interface OnboardingContextType {
  isComplete: boolean;
  isLoaded: boolean;
  data: OnboardingData;
  setInvestingStyle: (style: InvestingStyle) => Promise<void>;
  setGoals: (goals: OnboardingGoal[]) => Promise<void>;
  setSelectedStocks: (stocks: Array<{ symbol: string; name: string }>) => Promise<void>;
  markComplete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType>({
  isComplete: false,
  isLoaded: false,
  data: { investingStyle: null, goals: [], selectedStocks: [] },
  setInvestingStyle: async () => {},
  setGoals: async () => {},
  setSelectedStocks: async () => {},
  markComplete: async () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isComplete, setIsComplete] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    investingStyle: null,
    goals: [],
    selectedStocks: [],
  });

  useEffect(() => {
    Promise.all([getOnboardingComplete(), getOnboardingData()]).then(
      ([complete, savedData]) => {
        setIsComplete(complete);
        setData(savedData);
        setIsLoaded(true);
      }
    );
  }, []);

  const setInvestingStyle = useCallback(async (style: InvestingStyle) => {
    const updated = { investingStyle: style };
    await saveOnboardingData(updated);
    setData((prev) => ({ ...prev, ...updated }));
  }, []);

  const setGoals = useCallback(async (goals: OnboardingGoal[]) => {
    const updated = { goals };
    await saveOnboardingData(updated);
    setData((prev) => ({ ...prev, ...updated }));
  }, []);

  const setSelectedStocks = useCallback(
    async (stocks: Array<{ symbol: string; name: string }>) => {
      const updated = { selectedStocks: stocks };
      await saveOnboardingData(updated);
      setData((prev) => ({ ...prev, ...updated }));
    },
    []
  );

  const markComplete = useCallback(async () => {
    await setOnboardingComplete(true);
    setIsComplete(true);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ isComplete, isLoaded, data, setInvestingStyle, setGoals, setSelectedStocks, markComplete }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
