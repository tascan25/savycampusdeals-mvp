import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnnouncementCategoryBadge } from "@/components/AnnouncementCategoryBadge";
import { AppText, Button } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { Announcement } from "@/types/announcement";

function formatExpiry(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AnnouncementSpotlightModal({
  announcement,
  onCta,
  onViewAll,
  onClose,
}: {
  announcement: Announcement | null;
  onCta: () => void;
  onViewAll: () => void;
  onClose: () => void;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(260, windowHeight - insets.top - insets.bottom - space.xl);
  const availableWidth = Math.min(420, windowWidth - space.xl);

  return (
    <Modal
      visible={Boolean(announcement)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {announcement ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={[styles.scroll, { maxHeight: availableHeight, width: availableWidth }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.card}>
              <View style={styles.header}>
                <AnnouncementCategoryBadge category={announcement.category} />
                {announcement.expires_at ? (
                  <View style={styles.expiryRow}>
                    <Ionicons name="time-outline" size={12} color={color.textTertiary} />
                    <AppText variant="caption" color={color.textTertiary}>
                      Until {formatExpiry(announcement.expires_at)}
                    </AppText>
                  </View>
                ) : null}
              </View>

              {announcement.image_url ? (
                <Image
                  source={{ uri: announcement.image_url }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.iconWrap}>
                  <Ionicons name="sparkles" size={26} color={color.onPrimary} />
                </View>
              )}

              <AppText variant="h2" style={styles.title}>
                {announcement.title}
              </AppText>
              <AppText variant="body" color={color.textSecondary} style={styles.message}>
                {announcement.message}
              </AppText>

              {announcement.cta_label ? (
                <Button label={announcement.cta_label} onPress={onCta} />
              ) : null}
              <Pressable onPress={onViewAll} style={styles.viewAll}>
                <AppText variant="small" color={color.textTertiary}>
                  View all announcements
                </AppText>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  scroll: { width: "100%", flexGrow: 0 },
  scrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.lg,
    gap: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.sm,
  },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  image: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, marginTop: space.xs },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xs,
  },
  title: { marginTop: space.xs },
  message: { lineHeight: 21 },
  viewAll: { alignItems: "center", paddingVertical: space.xs },
});
