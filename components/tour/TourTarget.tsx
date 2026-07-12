import { useRef, useEffect, ReactNode } from 'react';
import { View } from 'react-native';
import { useFeatureTour } from '@/context/feature-tour-context';

interface TourTargetProps {
  /** Must match a step id in TOUR_STEPS */
  stepId: string;
  children: ReactNode;
  /** Extra space added around the measured element for the spotlight cutout */
  padding?: number;
}

/**
 * Wraps a UI element so the feature tour can measure and spotlight it.
 * Uses measureInWindow so coordinates are in absolute screen space,
 * regardless of scroll position or nesting.
 */
export function TourTarget({ stepId, children, padding = 10 }: TourTargetProps) {
  const ref = useRef<View>(null);
  const { currentStep, isActive, setStepLayout } = useFeatureTour();

  useEffect(() => {
    if (!isActive || currentStep?.id !== stepId) return;

    const timerId = setTimeout(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setStepLayout({
            x: x - padding,
            y: y - padding,
            width: width + padding * 2,
            height: height + padding * 2,
          });
        }
      });
    }, 350);

    return () => clearTimeout(timerId);
  }, [isActive, currentStep?.id, stepId, padding, setStepLayout]);

  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}
