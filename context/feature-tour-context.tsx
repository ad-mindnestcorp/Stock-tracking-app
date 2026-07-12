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
    id: 'tab_bar',
    title: 'Navigate the app',
    description:
      'Explore your Watchlist, AI research, News, Earnings calendar, and Profile from here.',
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
