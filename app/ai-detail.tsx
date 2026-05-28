import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HOME } from '@/components/home/home-tokens';
import { SECTION_META } from '@/lib/ai-types';
import type {
  SectionKey,
  AIResearchFoundation,
  AIValuationFinancials,
  AIRiskRedTeaming,
  AITechnicals,
} from '@/lib/ai-types';

const VERDICT_COLORS: Record<string, { bg: string; text: string }> = {
  Strong: { bg: '#0d2d1a', text: HOME.positive },
  Positive: { bg: '#0d2d1a', text: HOME.positive },
  Low: { bg: '#0d2d1a', text: HOME.positive },
  Bullish: { bg: '#0d2d1a', text: HOME.positive },
  Moderate: { bg: '#2d2200', text: '#f5a623' },
  Neutral: { bg: '#1a1a1a', text: HOME.textSecondary },
  Elevated: { bg: '#2d1400', text: '#ff8c42' },
  Weak: { bg: '#2d0d0d', text: HOME.negative },
  Negative: { bg: '#2d0d0d', text: HOME.negative },
  High: { bg: '#2d0d0d', text: HOME.negative },
  Bearish: { bg: '#2d0d0d', text: HOME.negative },
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const style = VERDICT_COLORS[verdict] ?? { bg: HOME.cardElevated, text: HOME.textSecondary };
  return (
    <View style={[badge.wrap, { backgroundColor: style.bg }]}>
      <Text style={[badge.text, { color: style.text }]}>{verdict}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  text: { fontSize: 12, fontWeight: '700' },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoRow.wrap}>
      <Text style={infoRow.label}>{label}</Text>
      <Text style={infoRow.value}>{value}</Text>
    </View>
  );
}

const infoRow = StyleSheet.create({
  wrap: { gap: 4, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: HOME.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 14, color: HOME.textSecondary, lineHeight: 20 },
});

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionBlock.wrap}>
      <Text style={sectionBlock.title}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

const sectionBlock = StyleSheet.create({
  wrap: {
    backgroundColor: HOME.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 12,
    gap: 2,
  },
  title: { fontSize: 13, fontWeight: '700', color: HOME.textPrimary, marginBottom: 10 },
});

// ─── Section renderers ────────────────────────────────────────────────────────

function FoundationDetail({ data }: { data: AIResearchFoundation }) {
  return (
    <>
      <SectionBlock title="Business Model">
        <BulletList items={data.business_model} />
      </SectionBlock>
      <SectionBlock title="Competitive Moat">
        <BulletList items={data.moat} />
      </SectionBlock>
      <SectionBlock title="Catalysts">
        <BulletList items={data.catalysts} />
      </SectionBlock>
      <SectionBlock title="Risk / Reward Asymmetry">
        <BulletList items={data.asymmetry} />
      </SectionBlock>
      {data.insights?.length > 0 && (
        <SectionBlock title="Key Insights">
          <BulletList items={data.insights} />
        </SectionBlock>
      )}
    </>
  );
}

function ValuationDetail({ data }: { data: AIValuationFinancials }) {
  return (
    <>
      <SectionBlock title="Relative Valuation">
        <BulletList items={data.relative_valuation} />
      </SectionBlock>
      <SectionBlock title="Growth Metrics">
        <BulletList items={data.growth_metrics} />
      </SectionBlock>
      <SectionBlock title="Financial Health">
        <BulletList items={data.financial_health} />
      </SectionBlock>
      {data.metrics?.length > 0 && (
        <SectionBlock title="Key Metrics">
          <View style={styles.metricsGrid}>
            {data.metrics.map((m, i) => (
              <View key={i} style={styles.metricCell}>
                <Text style={styles.metricValue}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={styles.metricNote}>{m.note}</Text>
              </View>
            ))}
          </View>
        </SectionBlock>
      )}
    </>
  );
}

function RiskDetail({ data }: { data: AIRiskRedTeaming }) {
  return (
    <>
      <SectionBlock title="Bear Case">
        <BulletList items={data.bear_case} />
      </SectionBlock>
      <SectionBlock title="SEC Status">
        <BulletList items={data.sec_flags} />
      </SectionBlock>
      <SectionBlock title="Customer Concentration">
        <BulletList items={data.customer_concentration} />
      </SectionBlock>
      {data.risks?.length > 0 && (
        <SectionBlock title="Identified Risks">
          {data.risks.map((risk, i) => (
            <View key={i} style={styles.riskRow}>
              <View style={styles.riskHeader}>
                <Ionicons name="warning-outline" size={13} color="#ff8c42" />
                <Text style={styles.riskLabel}>{risk.label}</Text>
              </View>
              <Text style={styles.riskDesc}>{risk.description}</Text>
            </View>
          ))}
        </SectionBlock>
      )}
    </>
  );
}

function TechnicalsDetail({ data }: { data: AITechnicals }) {
  return (
    <>
      <SectionBlock title="Price Trend">
        <BulletList items={data.price_trend} />
      </SectionBlock>
      <SectionBlock title="Moving Averages">
        <BulletList items={data.moving_averages} />
      </SectionBlock>
      <SectionBlock title="RSI & Momentum">
        <BulletList items={data.rsi} />
      </SectionBlock>
      <SectionBlock title="Support & Resistance">
        <BulletList items={data.support_resistance} />
      </SectionBlock>
      <SectionBlock title="Technical View">
        <BulletList items={data.technical_view} />
      </SectionBlock>
    </>
  );
}

function GenericSectionDetail({ data }: { data: any }) {
  if (!data) return null;

  const renderValue = (val: any, key: string): React.ReactNode => {
    if (Array.isArray(val)) {
      // Arrays of strings -> bullet list
      if (val.length > 0 && typeof val[0] === 'string') {
        return <BulletList items={val} />;
      }
      // Arrays of objects -> render each object
      if (val.length > 0 && typeof val[0] === 'object') {
        return (
          <>
            {val.map((item, i) => (
              <View key={i} style={styles.genericObjectRow}>
                {Object.entries(item).map(([k, v]) => (
                  <Text key={k} style={styles.genericObjectText}>
                    <Text style={styles.genericObjectLabel}>{k}: </Text>
                    {String(v)}
                  </Text>
                ))}
              </View>
            ))}
          </>
        );
      }
    }
    if (typeof val === 'string') {
      return <Text style={styles.bodyText}>{val}</Text>;
    }
    return null;
  };

  const sections = Object.entries(data).filter(
    ([key]) => key !== 'verdict' && key !== 'comparison_table' && key !== 'quarterly_data' && key !== 'top_customers'
  );

  return (
    <>
      {sections.map(([key, value]) => {
        const title = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const content = renderValue(value, key);
        if (!content) return null;
        return (
          <SectionBlock key={key} title={title}>
            {content}
          </SectionBlock>
        );
      })}
      
      {/* Handle special table fields if present */}
      {data.comparison_table && Array.isArray(data.comparison_table) && (
        <SectionBlock title="Comparison Table">
          {data.comparison_table.map((row: any, i: number) => (
            <View key={i} style={styles.genericObjectRow}>
              {Object.entries(row).map(([k, v]) => (
                <Text key={k} style={styles.genericObjectText}>
                  <Text style={styles.genericObjectLabel}>{k}: </Text>
                  {String(v)}
                </Text>
              ))}
            </View>
          ))}
        </SectionBlock>
      )}
      {data.quarterly_data && Array.isArray(data.quarterly_data) && (
        <SectionBlock title="Quarterly Data">
          {data.quarterly_data.map((row: any, i: number) => (
            <View key={i} style={styles.genericObjectRow}>
              {Object.entries(row).map(([k, v]) => (
                <Text key={k} style={styles.genericObjectText}>
                  <Text style={styles.genericObjectLabel}>{k}: </Text>
                  {String(v)}
                </Text>
              ))}
            </View>
          ))}
        </SectionBlock>
      )}
      {data.top_customers && Array.isArray(data.top_customers) && (
        <SectionBlock title="Top Customers">
          {data.top_customers.map((row: any, i: number) => (
            <View key={i} style={styles.genericObjectRow}>
              {Object.entries(row).map(([k, v]) => (
                <Text key={k} style={styles.genericObjectText}>
                  <Text style={styles.genericObjectLabel}>{k}: </Text>
                  {String(v)}
                </Text>
              ))}
            </View>
          ))}
        </SectionBlock>
      )}
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AIDetailScreen() {
  const router = useRouter();
  const { symbol, section, data: rawData } = useLocalSearchParams<{
    symbol: string;
    section: string;
    data: string;
  }>();

  const sectionKey = section as SectionKey;
  const meta = SECTION_META[sectionKey];

  let parsedData: unknown = null;
  try {
    parsedData = rawData ? JSON.parse(rawData) : null;
  } catch {
    parsedData = null;
  }

  if (!meta || !parsedData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Unable to load section data.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const verdict = (parsedData as { verdict: string }).verdict ?? '';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={22} color={HOME.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSymbol}>{symbol}</Text>
          <Text style={styles.headerTitle}>{meta.title}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.sectionTitle}>{meta.title}</Text>
            <VerdictBadge verdict={verdict} />
          </View>
          <Text style={styles.sectionDesc}>{meta.description}</Text>
        </View>

        {/* Section-specific content */}
        {sectionKey === 'research_foundation' && (
          <FoundationDetail data={parsedData as AIResearchFoundation} />
        )}
        {sectionKey === 'valuation_financials' && (
          <ValuationDetail data={parsedData as AIValuationFinancials} />
        )}
        {sectionKey === 'risk_red_teaming' && (
          <RiskDetail data={parsedData as AIRiskRedTeaming} />
        )}
        {sectionKey === 'technicals' && (
          <TechnicalsDetail data={parsedData as AITechnicals} />
        )}
        
        {/* Generic insight renderer for other sections */}
        {!['research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals'].includes(sectionKey) && (
          <GenericSectionDetail data={parsedData as any} />
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={12} color={HOME.textMuted} />
          <Text style={styles.disclaimerText}>
            AI research is for informational purposes only and not financial advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HOME.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HOME.border,
  },
  backArrow: { width: 32 },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerSymbol: { fontSize: 12, fontWeight: '600', color: HOME.textSecondary },
  headerTitle: { fontSize: 15, fontWeight: '700', color: HOME.textPrimary },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 0 },

  summaryCard: {
    backgroundColor: HOME.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HOME.border,
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: HOME.textPrimary },
  sectionDesc: { fontSize: 13, color: HOME.textSecondary, lineHeight: 19 },

  bodyText: { fontSize: 14, color: HOME.textSecondary, lineHeight: 21 },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: HOME.accent,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: { fontSize: 14, color: HOME.textSecondary, lineHeight: 21, flex: 1 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCell: {
    backgroundColor: HOME.cardElevated,
    borderRadius: 10,
    padding: 12,
    width: '47%',
    gap: 3,
  },
  metricValue: { fontSize: 18, fontWeight: '700', color: HOME.textPrimary },
  metricLabel: { fontSize: 12, fontWeight: '600', color: HOME.textSecondary },
  metricNote: { fontSize: 11, color: HOME.textMuted },

  riskRow: { marginBottom: 14, gap: 5 },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskLabel: { fontSize: 13, fontWeight: '700', color: HOME.textPrimary },
  riskDesc: { fontSize: 13, color: HOME.textSecondary, lineHeight: 19, paddingLeft: 19 },

  genericObjectRow: { marginBottom: 12, gap: 4 },
  genericObjectText: { fontSize: 13, color: HOME.textSecondary, lineHeight: 19 },
  genericObjectLabel: { fontWeight: '600', color: HOME.textPrimary },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
  },
  disclaimerText: { fontSize: 11, color: HOME.textMuted, flex: 1, lineHeight: 15 },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 15, color: HOME.textSecondary },
  backBtn: {
    backgroundColor: HOME.card,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: HOME.border,
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: HOME.textPrimary },
});
