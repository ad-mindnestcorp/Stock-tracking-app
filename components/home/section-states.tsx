import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { HOME } from './home-tokens';

export function SectionError({
  message = 'Unable to load',
  onRetry,
  style,
}: {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.box, style]} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SectionEmpty({ message, style }: { message: string; style?: ViewStyle }) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function Skeleton({
  width,
  height,
  radius = 6,
  style,
}: {
  width: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        // @ts-expect-error string % is allowed in RN view widths
        { width, height, borderRadius: radius, backgroundColor: '#1a1a1a' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HOME.card,
    borderRadius: HOME.radius.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.border,
  },
  errorText: { color: HOME.negative, fontSize: 13, flex: 1 },
  retryText: { color: HOME.accent, fontWeight: '700', fontSize: 13 },
  emptyText: { color: HOME.textSecondary, fontSize: 13, textAlign: 'center', flex: 1 },
});
