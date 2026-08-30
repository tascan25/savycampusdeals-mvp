import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { apiGetStudentCard } from "@/api/verification";
import { queryKeys } from "@/api/queryKeys";
import { StudentCardView } from "@/components/StudentCardView";
import { AppText, Button, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export default function CardTab() {
  const { user } = useAuth();
  const router = useRouter();
  const isApproved = user?.verification_status === "approved";

  const cardQuery = useQuery({
    queryKey: queryKeys.studentCard.root(),
    queryFn: apiGetStudentCard,
    enabled: isApproved,
  });

  if (!isApproved) {
    return (
      <Screen>
        <View style={styles.locked}>
          <View style={styles.lockedIcon}>
            <Ionicons name="lock-closed" size={26} color={color.textTertiary} />
          </View>
          <AppText variant="h1" style={styles.lockedTitle}>
            Verify to unlock your pass
          </AppText>
          <AppText variant="body" color={color.textSecondary} style={styles.lockedBody}>
            Your digital student card unlocks after verification.
          </AppText>
          <Button label="Verify now" onPress={() => router.push("/verify")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.content}>
        <AppText variant="h1">Student ID</AppText>
        <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
          Your verified membership, ready at every partner outlet.
        </AppText>

        <View style={styles.cardWrap}>
          {cardQuery.isLoading || !cardQuery.data ? (
            <View style={styles.skeleton} />
          ) : (
            <StudentCardView card={cardQuery.data} />
          )}
        </View>
        <View style={styles.reassurance}>
          <Ionicons name="lock-closed-outline" size={15} color={color.textTertiary} />
          <AppText variant="caption" color={color.textTertiary}>Your QR shares only the details needed to verify membership.</AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  locked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.md,
  },
  lockedIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: { textAlign: "center" },
  lockedBody: { textAlign: "center" },
  content: { flex: 1, padding: space.lg, gap: space.xs },
  subtitle: { marginBottom: space.md },
  cardWrap: { marginTop: space.md },
  reassurance: { marginTop: space.lg, flexDirection: "row", alignItems: "center", gap: space.sm },
  skeleton: {
    aspectRatio: 1.586,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
});
