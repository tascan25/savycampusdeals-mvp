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
import { getVerificationHref } from "@/utils/verificationRoute";

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
          <Button label="Verify now" onPress={() => router.push(getVerificationHref(user))} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.content}>
        <AppText variant="caption" color="#818CF8" style={styles.eyebrow}>
          YOUR STUDENT PASS
        </AppText>
        <AppText variant="h1" style={styles.title}>
          Show it. Save more.
        </AppText>
        <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
          Store it on your phone. Show it at partner outlets for instant discounts.
        </AppText>

        <View style={styles.cardWrap}>
          {cardQuery.isLoading || !cardQuery.data ? (
            <View style={styles.skeleton} />
          ) : (
            <StudentCardView card={cardQuery.data} />
          )}
        </View>
        <View style={styles.reassurance}>
          <Ionicons name="move-outline" size={15} color="#5EEAD4" />
          <AppText variant="caption" color={color.textTertiary}>
            Swipe across the card to tilt it and move the light.
          </AppText>
        </View>
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={14} color={color.textTertiary} />
          <AppText variant="caption" color={color.textTertiary} style={styles.privacyText}>
            Your QR shares only the details needed to verify membership.
          </AppText>
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
  eyebrow: { letterSpacing: 2.4, fontWeight: "800" },
  title: { marginTop: 2, letterSpacing: -0.55 },
  subtitle: { marginTop: space.xs, marginBottom: space.sm },
  cardWrap: { marginTop: space.xs },
  reassurance: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  privacyNote: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  privacyText: { flex: 1 },
  skeleton: {
    aspectRatio: 1.586,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
});
