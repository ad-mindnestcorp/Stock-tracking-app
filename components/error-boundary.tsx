import { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console in development; swap for Sentry/Crashlytics in production
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private handleRestart = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        {/* Logo area */}
        <View style={styles.badge}>
          <Text style={styles.badgeLetter}>S</Text>
        </View>

        <Text style={styles.appName}>Stockvest</Text>

        <Text style={styles.headline}>Something went wrong</Text>
        <Text style={styles.subtext}>
          The app ran into an unexpected problem. Your data is safe — tap below to
          restart and get back on track.
        </Text>

        {/* Collapsible error detail (dev-friendly) */}
        {__DEV__ && (
          <ScrollView style={styles.devBox} contentContainerStyle={styles.devBoxContent}>
            <Text style={styles.devLabel}>Error details (dev only)</Text>
            <Text style={styles.devMessage}>{this.state.errorMessage}</Text>
          </ScrollView>
        )}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={this.handleRestart}
          accessibilityRole="button"
          accessibilityLabel="Restart the app"
        >
          <Text style={styles.buttonText}>Restart App</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.dark,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: 32,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  devBox: {
    maxHeight: 140,
    width: '100%',
    backgroundColor: '#111',
    borderRadius: Radius.md,
    marginBottom: 24,
  },
  devBoxContent: {
    padding: 12,
  },
  devLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devMessage: {
    fontSize: 12,
    color: Colors.negative,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark,
  },
});
