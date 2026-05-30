import { HOME } from "@/components/home/home-tokens";
import ImportantEarnings from "@/components/home/important-earnings";
import NewsList from "@/components/home/news-list";
import TabSwitcher from "@/components/home/tab-switcher";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Tab = "news" | "earnings";

const TABS: { key: Tab; label: string }[] = [
  { key: "news", label: "Market News" },
  { key: "earnings", label: "Important Earnings" },
];

export default function NewsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("news");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["marketNews"] });
      await queryClient.invalidateQueries({
        queryKey: ["market", "earnings-calendar"],
      });
      await queryClient.invalidateQueries({ queryKey: ["important-earnings"] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>News</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={HOME.accent}
          />
        }
      >
        <TabSwitcher tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === "news" ? <NewsList limit={30} /> : <ImportantEarnings />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HOME.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: { fontSize: 28, fontWeight: "700", color: HOME.textPrimary },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});
