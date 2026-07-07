import { View, StyleSheet } from 'react-native';

interface StepProgressProps {
  totalSteps: number;
  currentStep: number;
}

export function StepProgress({ totalSteps, currentStep }: StepProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < currentStep ? styles.dotComplete : i === currentStep ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#CCFF00',
  },
  dotComplete: {
    width: 8,
    backgroundColor: '#CCFF00',
    opacity: 0.6,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#333333',
  },
});
