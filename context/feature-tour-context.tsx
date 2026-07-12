import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type TourStepLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TourStep = {
  id: string;
  title: string;
  description: string;
  /** Expo Router href to navigate to when this step becomes active */
  tabRoute?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'index_cards',
    title: 'Market at a glance',
    description:
      'Track the S&P 500, NASDAQ, and Dow Jones in real time. Tap any card to see full details.',
  },
  {
    id: 'top_movers',
    title: "Today's top movers",
    description:
      'See which stocks are surging or dropping the most — updated throughout the trading day.',
  },
  {
    id: 'your_stocks',
    title: 'Your watchlist',
    description:
      'Stocks you follow, with live prices and % change. Tap any row to view details and AI research.',
  },
  {
    id: 'heatmap',
    title: 'Market heatmap',
    description:
      'Visualise sector performance at a glance. Greens are gaining, reds are falling.',
  },
  {
    id: 'watchlist_screen',
    title: 'Manage your watchlists',
    description:
      'Organise stocks into multiple watchlists. Each row shows RSI, 52-week position, momentum, and volume signals at a glance.',
    tabRoute: '/(tabs)/watchlist',
  },
  {
    id: 'ai_screen',
    title: 'AI Stock Research',
    description:
      'Search any ticker for an instant institutional-grade report — research foundation, valuation, risk analysis, and an AI verdict.',
    tabRoute: '/(tabs)/ai',
  },
  {
    id: 'news_screen',
    title: 'Stay informed',
    description:
      'Filter news by Markets, your stocks, Earnings, or the broader Economy. Stories update throughout the day.',
    tabRoute: '/(tabs)/news',
  },
  {
    id: 'earnings_screen',
    title: 'Earnings calendar',
    description:
      'See upcoming and recent earnings for the stocks you follow. Know exactly when companies report before it moves the price.',
    tabRoute: '/(tabs)/earnings',
  },
];

export const CURRENT_TOUR_VERSION = 1;

interface FeatureTourContextType {
  isActive: boolean;
  isCompleting: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  stepLayout: TourStepLayout | null;
  startTour: () => void;
  nextStep: () => void;
  skipTour: () => void;
  setStepLayout: (layout: TourStepLayout) => void;
  dismissCompletion: () => void;
}

const FeatureTourContext = createContext<FeatureTourContextType>({
  isActive: false,
  isCompleting: false,
  currentStepIndex: -1,
  currentStep: null,
  stepLayout: null,
  startTour: () => {},
  nextStep: () => {},
  skipTour: () => {},
  setStepLayout: () => {},
  dismissCompletion: () => {},
});

type TourPhase = 'idle' | 'active' | 'completing' | 'done';

export function FeatureTourProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<TourPhase>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [stepLayout, setStepLayoutState] = useState<TourStepLayout | null>(null);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setStepLayoutState(null);
    setPhase('active');
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= TOUR_STEPS.length) {
        setPhase('completing');
        return prev;
      }
      setStepLayoutState(null);
      return next;
    });
  }, []);

  const skipTour = useCallback(() => {
    setPhase('done');
    setCurrentStepIndex(-1);
    setStepLayoutState(null);
  }, []);

  const dismissCompletion = useCallback(() => {
    setPhase('done');
    setCurrentStepIndex(-1);
    setStepLayoutState(null);
  }, []);

  const setStepLayout = useCallback((layout: TourStepLayout) => {
    setStepLayoutState(layout);
  }, []);

  const currentStep =
    phase === 'active' && currentStepIndex >= 0 ? TOUR_STEPS[currentStepIndex] : null;

  return (
    <FeatureTourContext.Provider
      value={{
        isActive: phase === 'active',
        isCompleting: phase === 'completing',
        currentStepIndex,
        currentStep,
        stepLayout,
        startTour,
        nextStep,
        skipTour,
        setStepLayout,
        dismissCompletion,
      }}
    >
      {children}
    </FeatureTourContext.Provider>
  );
}

export const useFeatureTour = () => useContext(FeatureTourContext);
