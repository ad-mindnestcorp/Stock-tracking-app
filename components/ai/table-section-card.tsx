import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { HOME } from '@/components/home/home-tokens';

interface TableSectionCardProps {
  title: string;
  headers: string[];
  rows: string[][];
  insights?: string[];
}

export function TableSectionCard({ title, headers, rows, insights }: TableSectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.headerRow}>
            {headers.map((header, i) => (
              <View key={i} style={[styles.cell, styles.headerCell, i === 0 && styles.firstCell]}>
                <Text style={styles.headerText}>{header}</Text>
              </View>
            ))}
          </View>
          
          {/* Data rows */}
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.dataRow}>
              {row.map((cell, cellIndex) => (
                <View key={cellIndex} style={[styles.cell, cellIndex === 0 && styles.firstCell]}>
                  <Text style={[styles.cellText, cellIndex === 0 && styles.symbolText]}>{cell}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {insights && insights.length > 0 && (
        <View style={styles.insightsWrap}>
          {insights.map((insight, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={styles.bullet} />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HOME.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 12,
    gap: 10,
  },
  title: { fontSize: 14, fontWeight: '700', color: HOME.textPrimary },
  
  tableScroll: { marginHorizontal: -14 },
  table: { paddingHorizontal: 14 },
  
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HOME.border, paddingBottom: 8 },
  dataRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: HOME.border + '40' },
  
  cell: { width: 90, justifyContent: 'center' },
  firstCell: { width: 80 },
  headerCell: {},
  
  headerText: { fontSize: 11, fontWeight: '700', color: HOME.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cellText: { fontSize: 13, color: HOME.textSecondary },
  symbolText: { fontSize: 13, fontWeight: '700', color: HOME.textPrimary },

  insightsWrap: { marginTop: 4, gap: 8 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: HOME.accent,
    marginTop: 7,
    flexShrink: 0,
  },
  insightText: { fontSize: 13, color: HOME.textSecondary, lineHeight: 19, flex: 1 },
});
