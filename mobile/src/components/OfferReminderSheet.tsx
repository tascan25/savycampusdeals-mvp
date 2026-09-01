import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { Offer } from "@/types/offer";

const HOUR_MS = 60 * 60 * 1000;

export function getLaterTodayReminderDate(now = new Date()): Date | null {
  const candidate = new Date(now.getTime() + 3 * HOUR_MS);
  return candidate.toDateString() === now.toDateString() ? candidate : null;
}

export function getTomorrowReminderDate(now = new Date()): Date {
  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() + 1);
  candidate.setHours(10, 0, 0, 0);
  return candidate;
}

export function formatReminderDate(value: Date | number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function OfferReminderSheet({
  visible,
  offer,
  existingFireAt,
  working,
  error,
  onSchedule,
  onCancelReminder,
  onDismiss,
}: {
  visible: boolean;
  offer: Offer | null;
  existingFireAt?: number;
  working: boolean;
  error?: string | null;
  onSchedule: (date: Date) => void;
  onCancelReminder: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showCustom, setShowCustom] = useState(false);
  const [now] = useState(() => new Date());
  const [minimumDate] = useState(() => new Date(Date.now() + 60_000));
  const [customDate, setCustomDate] = useState(() =>
    existingFireAt && existingFireAt > Date.now()
      ? new Date(existingFireAt)
      : new Date(Date.now() + HOUR_MS),
  );
  const laterToday = getLaterTodayReminderDate(now);
  const tomorrow = getTomorrowReminderDate(now);

  const openCustomPicker = () => {
    if (Platform.OS === "ios") {
      setShowCustom(true);
      return;
    }
    const initial = customDate;
    DateTimePickerAndroid.open({
      value: initial,
      mode: "date",
      minimumDate: new Date(),
      onChange: (dateEvent: DateTimePickerEvent, selectedDate?: Date) => {
        if (dateEvent.type !== "set" || !selectedDate) return;
        const datedValue = new Date(selectedDate);
        datedValue.setHours(initial.getHours(), initial.getMinutes(), 0, 0);
        DateTimePickerAndroid.open({
          value: datedValue,
          mode: "time",
          onChange: (timeEvent: DateTimePickerEvent, selectedTime?: Date) => {
            if (timeEvent.type !== "set" || !selectedTime) return;
            const result = new Date(datedValue);
            result.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
            setCustomDate(result);
            onSchedule(result);
          },
        });
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityLabel="Close offer reminder options"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) + space.sm }]}
        >
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="alarm-outline" size={23} color="#C7D2FE" />
            </View>
            <View style={styles.headingCopy}>
              <AppText variant="h3">Remind me</AppText>
              <AppText variant="small" color={color.textSecondary} numberOfLines={2}>
                {offer ? `${offer.brand}: ${offer.title}` : "Saved offer"}
              </AppText>
            </View>
          </View>

          {existingFireAt ? (
            <View style={styles.currentReminder}>
              <Ionicons name="checkmark-circle" size={18} color={color.success} />
              <AppText variant="small" color={color.textSecondary} style={styles.flexCopy}>
                Currently scheduled for {formatReminderDate(existingFireAt)}
              </AppText>
            </View>
          ) : null}

          {!showCustom ? (
            <View style={styles.options}>
              {laterToday ? (
                <ReminderOption
                  icon="sunny-outline"
                  title="Later today"
                  detail={formatReminderDate(laterToday)}
                  disabled={working}
                  onPress={() => onSchedule(laterToday)}
                />
              ) : null}
              <ReminderOption
                icon="calendar-outline"
                title="Tomorrow"
                detail={formatReminderDate(tomorrow)}
                disabled={working}
                onPress={() => onSchedule(tomorrow)}
              />
              <ReminderOption
                icon="options-outline"
                title="Custom date and time"
                detail="Choose exactly when Savvy should remind you"
                disabled={working}
                onPress={openCustomPicker}
              />
            </View>
          ) : null}

          {Platform.OS === "ios" && showCustom ? (
            <View style={styles.iosPicker}>
              <DateTimePicker
                value={customDate}
                mode="datetime"
                display="spinner"
                minimumDate={minimumDate}
                themeVariant="dark"
                accentColor={color.primary}
                onChange={(_event, value) => value && setCustomDate(value)}
              />
              <Button
                label={`Schedule for ${formatReminderDate(customDate)}`}
                loading={working}
                onPress={() => onSchedule(customDate)}
              />
              <Button
                label="Back to quick options"
                variant="secondary"
                disabled={working}
                onPress={() => setShowCustom(false)}
              />
            </View>
          ) : null}

          {error ? (
            <AppText variant="small" color={color.destructive} style={styles.error}>
              {error}
            </AppText>
          ) : null}

          {existingFireAt ? (
            <Button
              label="Cancel this reminder"
              variant="secondary"
              disabled={working}
              onPress={onCancelReminder}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ReminderOption({
  icon,
  title,
  detail,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={19} color="#C7D2FE" />
      </View>
      <View style={styles.flexCopy}>
        <AppText variant="bodyMedium">{title}</AppText>
        <AppText variant="caption" color={color.textTertiary}>
          {detail}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" },
  sheet: {
    maxHeight: "92%",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceElevated,
  },
  handle: {
    width: 42,
    height: 5,
    alignSelf: "center",
    borderRadius: radius.pill,
    backgroundColor: color.borderStrong,
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  headingCopy: { flex: 1, gap: 2 },
  iconWrap: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: color.primarySoft,
  },
  currentReminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  options: { gap: space.sm },
  option: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  optionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: color.primarySoft,
  },
  iosPicker: { gap: space.sm },
  flexCopy: { flex: 1 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  error: { textAlign: "center" },
});
