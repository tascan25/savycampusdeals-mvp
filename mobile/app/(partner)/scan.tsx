import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { apiScanLookup, apiScanRedeem } from "@/api/partner";
import { queryKeys } from "@/api/queryKeys";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { AppText, Button, Screen, SegmentedControl } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { toApiError } from "@/api/errors";
import type { ScanLookupResult } from "@/types/partner";

type Mode = "camera" | "manual";

function resultIsRedeemable(result: ScanLookupResult): boolean {
  if (result.kind === "student") return false;
  return (
    result.status === "active" &&
    !result.expired &&
    Boolean(result.student_verified) &&
    !result.student_expiry_expired
  );
}

function ScanResultCard({
  result,
  onRedeem,
  redeeming,
}: {
  result: ScanLookupResult;
  onRedeem: () => void;
  redeeming: boolean;
}) {
  const studentVerified =
    result.kind === "student" ? Boolean(result.verified) : Boolean(result.student_verified);
  const title = result.offer_title || result.reward_title || "Student verification";
  const studentName = result.student_name || result.name || "Savvy student";
  const status =
    result.kind === "student"
      ? studentVerified
        ? "verified"
        : "not verified"
      : result.status || "unknown";
  const good = studentVerified && status !== "expired";

  return (
    <View style={styles.resultCard}>
      <View
        style={[
          styles.resultStatus,
          { backgroundColor: good ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" },
        ]}
      >
        <Ionicons
          name={good ? "shield-checkmark" : "warning"}
          size={17}
          color={good ? color.success : color.destructive}
        />
        <AppText variant="small" color={good ? color.success : color.destructive}>
          {status.toUpperCase()}
        </AppText>
      </View>
      <View style={styles.studentBlock}>
        <View style={styles.studentIcon}>
          <AppText variant="h2">{studentName.charAt(0).toUpperCase()}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="h2" numberOfLines={1}>
            {studentName}
          </AppText>
          <AppText variant="small" color={color.textSecondary}>
            {result.student_college ||
              result.college ||
              result.student_number ||
              "Student details verified securely"}
          </AppText>
        </View>
      </View>
      <View style={styles.offerBlock}>
        <AppText variant="caption" color={color.textTertiary}>
          {result.kind === "student"
            ? "STUDENT PASS"
            : result.brand?.toUpperCase() || "SAVVY REWARD"}
        </AppText>
        <AppText variant="bodyMedium">{title}</AppText>
        {result.discount ? (
          <AppText variant="h3" color={color.success}>
            {result.discount}
          </AppText>
        ) : null}
        {result.code ? (
          <AppText variant="caption" color={color.textTertiary}>
            {result.code}
          </AppText>
        ) : null}
      </View>
      {resultIsRedeemable(result) && result.code ? (
        <Button label="Confirm redemption" onPress={onRedeem} loading={redeeming} />
      ) : result.kind !== "student" ? (
        <View style={styles.blocked}>
          <AppText variant="small" color={color.textSecondary}>
            {result.status === "redeemed"
              ? "This code has already been redeemed."
              : result.expired || result.status === "expired"
                ? "This code has expired."
                : "Redemption is unavailable because student verification is inactive."}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export default function PartnerScannerScreen() {
  const [mode, setMode] = useState<Mode>("camera");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanLookupResult | null>(null);
  const [scanned, setScanned] = useState(false);
  const [focused, setFocused] = useState(false);
  const scanLock = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const lookup = useMutation({
    mutationFn: apiScanLookup,
    retry: false,
    onSuccess: setResult,
    onError: (error) => {
      scanLock.current = false;
      setScanned(false);
      Alert.alert("Code not accepted", toApiError(error).message);
    },
  });
  const redeem = useMutation({
    mutationFn: apiScanRedeem,
    retry: false,
    onSuccess: (data) => {
      setResult((current) =>
        current ? { ...current, status: "redeemed", redeemed_at: data.redeemed_at } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.partner.root() });
      Alert.alert(
        "Redemption complete",
        `${data.student_name || "The student"}'s coupon has been marked as redeemed.`,
      );
    },
    onError: (error) => Alert.alert("Redemption failed", toApiError(error).message),
  });

  const submit = (payload: string) => {
    const value = payload.trim();
    if (!value || lookup.isPending || scanLock.current) return;
    scanLock.current = true;
    setScanned(true);
    setResult(null);
    lookup.mutate(value);
  };
  const reset = () => {
    setResult(null);
    setScanned(false);
    setManual("");
    scanLock.current = false;
    lookup.reset();
  };
  const confirmRedemption = () => {
    if (!result?.code) return;
    const name = result.student_name || result.name || "this student";
    const offer = result.offer_title || result.reward_title || "this Savvy reward";
    Alert.alert("Confirm redemption", `Redeem ${offer} for ${name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Redeem", onPress: () => redeem.mutate(result.code!) },
    ]);
  };

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <AppText variant="caption" color={color.success} style={styles.eyebrow}>
            SECURE REDEMPTION
          </AppText>
          <AppText variant="h1">Scanner</AppText>
          <AppText variant="small" color={color.textSecondary}>
            Verify first. Confirm once. Every redemption is recorded.
          </AppText>
        </View>
        <SegmentedControl
          options={[
            { value: "camera", label: "Camera" },
            { value: "manual", label: "Enter code" },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            reset();
          }}
        />

        {mode === "camera" ? (
          !permission ? (
            <LoadingShimmer style={styles.camera} />
          ) : !permission.granted ? (
            <View style={styles.permissionCard}>
              <Ionicons name="camera-outline" size={34} color={color.primary} />
              <AppText variant="h3">Camera access needed</AppText>
              <AppText variant="small" color={color.textSecondary} style={styles.center}>
                Savvy uses the camera only to read QR codes. No photo or video is saved.
              </AppText>
              <Button
                label={permission.canAskAgain ? "Allow camera" : "Open settings"}
                onPress={() => {
                  if (permission.canAskAgain) void requestPermission();
                  else void Linking.openSettings();
                }}
              />
            </View>
          ) : focused && !result ? (
            <View style={styles.cameraWrap}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanned ? undefined : ({ data }) => submit(data)}
                onMountError={({ message }) => Alert.alert("Camera unavailable", message)}
              />
              <View pointerEvents="none" style={styles.frame}>
                <View style={styles.scanBox} />
                <AppText variant="small" style={styles.cameraHint}>
                  Align the Savvy QR inside the frame
                </AppText>
              </View>
            </View>
          ) : null
        ) : (
          <View style={styles.manualCard}>
            <AppText variant="bodyMedium">Coupon or student code</AppText>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="SCD-XXXXXXXX or SVR-XXXXXXXX"
              placeholderTextColor={color.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={() => submit(manual)}
            />
            <Button
              label="Look up code"
              onPress={() => submit(manual)}
              loading={lookup.isPending}
              disabled={!manual.trim()}
            />
          </View>
        )}

        {lookup.isPending ? (
          <View style={styles.resultLoading}>
            <LoadingShimmer style={styles.resultLine} />
            <LoadingShimmer style={styles.resultName} />
            <LoadingShimmer style={styles.resultBody} />
          </View>
        ) : result ? (
          <>
            <ScanResultCard
              result={result}
              onRedeem={confirmRedemption}
              redeeming={redeem.isPending}
            />
            <Pressable onPress={reset} style={styles.scanAgain}>
              <Ionicons name="scan-outline" size={17} color={color.textPrimary} />
              <AppText variant="small">Scan another code</AppText>
            </Pressable>
          </>
        ) : mode === "manual" ? null : !permission?.granted ? null : (
          <View style={styles.waiting}>
            <Ionicons name="qr-code-outline" size={24} color={color.textTertiary} />
            <AppText variant="small" color={color.textTertiary}>
              Waiting for a Savvy QR code
            </AppText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120, gap: space.md },
  eyebrow: { letterSpacing: 1.8, fontWeight: "800" },
  camera: { height: 360, borderRadius: radius.xl },
  cameraWrap: {
    height: 360,
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: color.surface,
  },
  frame: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  scanBox: {
    width: 228,
    height: 228,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: color.success,
  },
  cameraHint: {
    position: "absolute",
    bottom: space.lg,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  permissionCard: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
  },
  center: { textAlign: "center" },
  manualCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
  },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceMuted,
    color: color.textPrimary,
    paddingHorizontal: space.md,
    fontSize: 16,
    letterSpacing: 1,
  },
  resultLoading: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
  },
  resultLine: { width: 120, height: 28 },
  resultName: { width: "72%", height: 34 },
  resultBody: { height: 100 },
  resultCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  resultStatus: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  studentBlock: { flexDirection: "row", alignItems: "center", gap: space.md },
  studentIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.primary,
  },
  flex: { flex: 1 },
  offerBlock: {
    gap: 5,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  blocked: { padding: space.md, borderRadius: radius.md, backgroundColor: color.surfaceMuted },
  scanAgain: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  waiting: { alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xl },
});
