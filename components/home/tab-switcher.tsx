import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HOME } from './home-tokens';

interface TabOption<T extends string> {
  key: T;
  label: string;
}

interface TabSwitcherProps<T extends string> {
  tabs: TabOption<T>[];
  active: T;
  onChange: (key: T) => void;
  /** Show a "View all" link aligned to the right */
  trailing?: React.ReactNode;
}

export default function TabSwitcher<T extends string>({
  tabs,
  active,
  onChange,
  trailing,
}: TabSwitcherProps<T>) {
  return (
    <View style={styles.row}>
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {trailing != null && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.borderSoft,
    marginBottom: 10,
  },
  tabRow: { flexDirection: 'row' },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabActive: { borderBottomColor: HOME.accent },
  tabText: {
    color: HOME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: { color: HOME.accent },
  trailing: { paddingHorizontal: 4 },
});
