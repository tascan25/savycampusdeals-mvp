import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { apiListSavedOffers, apiToggleSaveOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { OfferCard } from "@/components/OfferCard";
import { formatReminderDate, OfferReminderSheet } from "@/components/OfferReminderSheet";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { usePushNotifications } from "@/providers/PushNotificationProvider";
import {
  cancelSavedOfferReminder,
  listSavedOfferReminders,
  scheduleSavedOfferReminder,
  type SavedOfferReminder,
} from "@/services/localNotifications";
import type { Offer } from "@/types/offer";

export default function SavedOffersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { permission, enable, openSystemSettings } = usePushNotifications();
  const savedQuery = useQuery({ queryKey: queryKeys.offers.saved(), queryFn: apiListSavedOffers });
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [reminders, setReminders] = useState<Record<string, SavedOfferReminder>>({});
  const [reminderWorking, setReminderWorking] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const refreshLocalReminders = useCallback(async () => {
    if (!user) return;
    const entries = await listSavedOfferReminders(user.id);
    setReminders(Object.fromEntries(entries.map((entry) => [entry.offerId, entry])));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshLocalReminders();
    }, [refreshLocalReminders]),
  );

  const removeSaved = async (offer: Offer) => {
    const result = await apiToggleSaveOffer(offer.id);
    if (!result.saved && user) {
      await cancelSavedOfferReminder(user.id, offer.id);
      await refreshLocalReminders();
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });
  };

  const scheduleReminder = async (date: Date) => {
    if (!selectedOffer || !user) return;
    setReminderWorking(true);
    setReminderError(null);
    try {
      if (permission === "denied") {
        await openSystemSettings();
        setReminderError("Enable notifications in Settings, then choose the reminder again.");
        return;
      }
      const allowed = permission === "enabled" || (await enable());
      if (!allowed) {
        setReminderError("Notification permission is required to create this reminder.");
        return;
      }
      await scheduleSavedOfferReminder({
        ownerId: user.id,
        offer: selectedOffer,
        fireAt: date.getTime(),
      });
      await refreshLocalReminders();
      setSelectedOffer(null);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Couldn't schedule this reminder.");
    } finally {
      setReminderWorking(false);
    }
  };

  const cancelReminder = async () => {
    if (!selectedOffer || !user) return;
    setReminderWorking(true);
    setReminderError(null);
    try {
      await cancelSavedOfferReminder(user.id, selectedOffer.id);
      await refreshLocalReminders();
      setSelectedOffer(null);
    } finally {
      setReminderWorking(false);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <FlashList
        data={savedQuery.data ?? []}
        keyExtractor={(offer) => offer.id}
        contentContainerStyle={styles.content}
        refreshing={savedQuery.isRefetching}
        onRefresh={() => savedQuery.refetch()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <OfferCard
              offer={item}
              onPress={() => router.push(`/offer/${item.id}`)}
              onToggleSave={() => void removeSaved(item)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Set reminder for ${item.brand}: ${item.title}`}
              onPress={() => {
                setReminderError(null);
                setSelectedOffer(item);
              }}
              style={({ pressed }) => [styles.reminderButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={reminders[item.id] ? "alarm" : "alarm-outline"}
                size={17}
                color={reminders[item.id] ? "#C7D2FE" : color.textSecondary}
              />
              <AppText variant="small" color={reminders[item.id] ? "#C7D2FE" : color.textSecondary}>
                {reminders[item.id]
                  ? `Reminder: ${formatReminderDate(reminders[item.id]!.fireAt)}`
                  : "Remind me"}
              </AppText>
            </Pressable>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.intro}>
            <AppText variant="caption" color={color.textTertiary} style={styles.eyebrow}>
              YOUR SHORTLIST
            </AppText>
            <AppText variant="h2">Saved offers</AppText>
            <AppText variant="small" color={color.textSecondary}>
              Keep the deals you want to revisit in one place.
            </AppText>
          </View>
        }
        ListEmptyComponent={
          !savedQuery.isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bookmark-outline" size={29} color="#D8B4FE" />
              </View>
              <AppText variant="h3">Nothing saved yet</AppText>
              <AppText variant="small" color={color.textTertiary} style={styles.emptyCopy}>
                Tap the bookmark on any offer and it will appear here.
              </AppText>
              <Pressable
                style={styles.exploreButton}
                onPress={() =>
                  router.replace({ pathname: "/(tabs)/explore", params: { tab: "deals" } } as never)
                }
              >
                <AppText variant="small" style={styles.exploreLabel}>
                  Browse deals
                </AppText>
              </Pressable>
            </View>
          ) : null
        }
      />
      {selectedOffer ? (
        <OfferReminderSheet
          visible
          offer={selectedOffer}
          existingFireAt={reminders[selectedOffer.id]?.fireAt}
          working={reminderWorking}
          error={reminderError}
          onSchedule={(date) => void scheduleReminder(date)}
          onCancelReminder={() => void cancelReminder()}
          onDismiss={() => {
            if (reminderWorking) return;
            setSelectedOffer(null);
            setReminderError(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  intro: { marginBottom: space.lg, gap: 3 },
  eyebrow: { letterSpacing: 1.8 },
  card: { marginBottom: space.lg },
  reminderButton: {
    minHeight: 44,
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  pressed: { opacity: 0.76 },
  empty: {
    minHeight: 350,
    padding: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    marginBottom: space.md,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(147,51,234,0.16)",
  },
  emptyCopy: { maxWidth: 250, marginTop: space.sm, textAlign: "center", lineHeight: 19 },
  exploreButton: {
    minHeight: 44,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
  },
  exploreLabel: { color: "#111114", fontWeight: "800" },
});
