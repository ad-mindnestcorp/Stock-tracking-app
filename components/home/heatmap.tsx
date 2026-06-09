import { useSectors } from "@/hooks/use-sectors";
import type { SectorData } from "@/lib/api";
import { formatPercent } from "@/lib/formatters";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getChangeColor, getHeatmapColor } from "./home-tokens";
import { SectionError, Skeleton } from "./section-states";

const TOP_SECTORS = [
  "Technology",
  "Financial",
  "Healthcare",
  "Consumer Cyclical",
  "Industrials",
  "Energy",
];

export default function Heatmap() {
  const { data, isLoading, isError, error, refetch } = useSectors();

  if (isError) return <SectionError message={error?.message} onRetry={() => refetch()} />;

  if (isLoading || !data) {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="32%" height={56} radius={6} />
          ))}
        </View>
        <View style={[styles.row, { marginTop: 4 }]}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="32%" height={56} radius={6} />
          ))}
        </View>
      </View>
    );
  }

  // Order top six by the design (Technology first), then any extras below in a smaller row.
  const top = TOP_SECTORS.map((name) =>
    data.find((d) => d.sector === name),
  ).filter((s): s is SectorData => s != null);
  const remaining = data.filter((d) => !TOP_SECTORS.includes(d.sector));

  return (
    <View style={styles.container}>
      <View style={styles.grid3}>
        {top.map((s) => (
          <Tile key={s.etf} sector={s} />
        ))}
      </View>
      {remaining.length > 0 && (
        <View style={[styles.grid3, { marginTop: 4 }]}>
          {remaining.map((s) => (
            <Tile key={s.etf} sector={s} small />
          ))}
        </View>
      )}
    </View>
  );
}

function Tile({ sector, small }: { sector: SectorData; small?: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[
        styles.tile,
        { backgroundColor: getHeatmapColor(sector.changePercent) },
        small && styles.tileSmall,
      ]}
      onPress={() => router.push(`/stock/${sector.etf}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${sector.sector}, ${formatPercent(sector.changePercent)}`}
    >
      <Text style={styles.tileName} numberOfLines={1}>
        {sector.sector}
      </Text>
      <Text
        style={[
          styles.tilePct,
          { color: getChangeColor(sector.changePercent) },
        ]}
      >
        {formatPercent(sector.changePercent)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 4 },
  grid3: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tile: {
    width: "32.5%",
    minHeight: 56,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  tileSmall: {
    minHeight: 38,
    paddingVertical: 6,
  },
  tileName: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  tilePct: {
    fontSize: 12,
    fontWeight: "700",
  },
});
