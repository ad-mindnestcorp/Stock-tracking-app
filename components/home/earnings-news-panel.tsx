import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TabSwitcher from './tab-switcher';
import EarningsTodayGrid from './earnings-today-grid';
import NewsList from './news-list';
import { HOME } from './home-tokens';

type Tab = 'earnings' | 'news';

const TABS: { key: Tab; label: string }[] = [
  { key: 'earnings', label: 'Earnings Today' },
  { key: 'news', label: 'News' },
];

export default function EarningsNewsPanel() {
  const [active, setActive] = useState<Tab>('earnings');

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
      {active === 'earnings' ? <EarningsTodayGrid /> : <NewsList />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 14, marginBottom: 16 },
  viewAll: { color: HOME.accent, fontSize: 12 },
});
