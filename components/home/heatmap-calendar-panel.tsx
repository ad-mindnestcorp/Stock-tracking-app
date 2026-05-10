import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TabSwitcher from './tab-switcher';
import Heatmap from './heatmap';
import Calendar from './calendar';
import { HOME } from './home-tokens';

type Tab = 'heatmap' | 'calendar';

const TABS: { key: Tab; label: string }[] = [
  { key: 'heatmap', label: 'Market Heatmap' },
  { key: 'calendar', label: 'Calendar' },
];

export default function HeatmapCalendarPanel() {
  const [active, setActive] = useState<Tab>('heatmap');

  return (
    <View style={styles.section}>
      <TabSwitcher
        tabs={TABS}
        active={active}
        onChange={setActive}
        trailing={
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all">
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        }
      />
      {active === 'heatmap' ? <Heatmap /> : <Calendar />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 8 },
  viewAll: { color: HOME.accent, fontSize: 12 },
});
