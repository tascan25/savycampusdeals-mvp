import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";

import { AnnouncementCategoryBadge } from "@/components/AnnouncementCategoryBadge";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { Announcement } from "@/types/announcement";

function formatExpiry(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AnnouncementCentreModal({
  visible,
  items,
  onCta,
  onClose,
}: {
  visible: boolean;
  items: Announcement[];
  onCta: (announcement: Announcement) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <Screen style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText variant="h2">What&apos;s new</AppText>
            <AppText variant="small" color={color.textSecondary}>
              Fresh updates and important Savvy news.
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.closeButton}
          >
            <Ionicons name="close" size={20} color={color.textSecondary} />
          </Pressable>
        </View>

        <FlatList
          style={styles.scroll}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={24} color={color.textTertiary} />
              <AppText variant="small" color={color.textSecondary} style={styles.emptyTitle}>
                You&apos;re all caught up
              </AppText>
              <AppText variant="caption" color={color.textTertiary}>
                New Savvy drops will appear here.
              </AppText>
            </View>
          }
          renderItem={({ item: announcement }) => (
            <Pressable
              onPress={() => (announcement.cta_label ? onCta(announcement) : undefined)}
              style={styles.card}
            >
              {!announcement.seen ? <View style={styles.unreadDot} /> : null}
              <View style={styles.cardHeader}>
                <AnnouncementCategoryBadge category={announcement.category} />
                <AppText variant="caption" color={color.textTertiary}>
                  Until {formatExpiry(announcement.expires_at)}
                </AppText>
              </View>
              <AppText variant="bodyMedium" style={styles.cardTitle}>
                {announcement.title}
              </AppText>
              <AppText variant="small" color={color.textSecondary} style={styles.cardMessage}>
                {announcement.message}
              </AppText>
              {announcement.cta_label ? (
                <View style={styles.ctaRow}>
                  <AppText variant="small" color={color.primary}>
                    {announcement.cta_label}
                  </AppText>
                  <Ionicons name="arrow-forward" size={14} color={color.primary} />
                </View>
              ) : null}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: space.lg,
    gap: space.md,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  closeButton: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: color.surfaceMuted,
  },
  scroll: { flex: 1, width: "100%" },
  list: { flexGrow: 1, width: "100%", padding: space.lg, paddingTop: 0 },
  separator: { height: space.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
    gap: space.xs,
  },
  unreadDot: {
    position: "absolute",
    top: space.md,
    right: space.md,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingRight: space.md,
  },
  cardTitle: { marginTop: space.xs },
  cardMessage: { lineHeight: 19 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs },
  empty: { alignItems: "center", gap: space.xs, paddingVertical: space.xxl },
  emptyTitle: { marginTop: space.xs },
});
