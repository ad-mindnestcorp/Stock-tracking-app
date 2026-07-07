import { type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const colors = theme?.colors;

  if (!colors) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        <Text style={{ color: "#fff" }}>Loading...</Text>
      </View>
    );
  }

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="checkmark-circle"
              size={80}
              color={colors.positive}
            />
          </View>

          {/* Header */}
          <Text style={styles.heading}>Congratulations!</Text>

          {/* Description */}
          <Text style={styles.description}>
            Your email has been verified. Please login in the app now.
          </Text>

          <Text style={styles.note}>
            Open the Vesto app on your phone and log in to get started.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    content: {
      alignItems: "center",
      width: "100%",
    },
    iconContainer: {
      marginBottom: 32,
    },
    heading: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: "center",
    },
    description: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 24,
    },
    note: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 18,
    },
  });
}
