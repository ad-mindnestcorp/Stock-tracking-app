import { View, Text, StyleSheet } from 'react-native';
import Heatmap from './heatmap';
import { HOME } from './home-tokens';

export default function HeatmapCalendarPanel() {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Market Heatmap</Text>
      <Heatmap />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600', color: HOME.textPrimary, marginBottom: 10 },
});
