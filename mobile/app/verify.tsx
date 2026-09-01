import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState, type PropsWithChildren } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { toApiError } from "@/api/errors";
import { apiStartReverification, apiSubmitVerification } from "@/api/verification";
import {
  LoginBackdrop,
  LoginField,
  LoginPrimaryButton,
  SavvyWordmark,
} from "@/components/LoginChrome";
import { VerificationImagePicker } from "@/components/VerificationImagePicker";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { presentVerificationSubmittedNotification } from "@/services/localNotifications";
import { verificationFormSchema, type VerificationFormValues } from "@/validation/verification";

function VerificationShell({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}>) {
  const router = useRouter();
  return (
    <Screen>
      <LoginBackdrop quiet />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              accessibilityRole="button"
              accessibilityLabel="Back to Savvy Campus"
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={20} color={color.textPrimary} />
            </Pressable>
            <SavvyWordmark />
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.intro}>
            <View style={styles.introMark}>
              <View style={styles.introAura} />
              <Ionicons name={icon} size={24} color="#E9D5FF" />
            </View>
            <AppText variant="caption" color="#B9B2FF" style={styles.eyebrow}>
              {eyebrow}
            </AppText>
            <AppText style={styles.title}>{title}</AppText>
            <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
              {subtitle}
            </AppText>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StatusScreen({
  icon,
  iconColor,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; loading?: boolean };
}) {
  return (
    <VerificationShell eyebrow="STUDENT VERIFICATION" title={title} subtitle={body} icon={icon}>
      <View style={styles.statusSurface}>
        <View
          style={[
            styles.statusIcon,
            { borderColor: `${iconColor}55`, backgroundColor: `${iconColor}13` },
          ]}
        >
          <Ionicons name={icon} size={32} color={iconColor} />
        </View>
        {action ? (
          <LoginPrimaryButton
            label={action.label}
            onPress={action.onPress}
            loading={action.loading}
          />
        ) : null}
      </View>
    </VerificationShell>
  );
}

export default function VerifyScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [collegeIdImage, setCollegeIdImage] = useState("");
  const [selfieImage, setSelfieImage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      college_name: user?.college ?? "",
      course: user?.course ?? "",
      year: user?.year ?? "",
      student_id_number: "",
    },
  });

  useEffect(() => {
    if (user?.role === "student" && !user.email_verified) {
      router.replace({ pathname: "/(auth)/verify-otp", params: { email: user.email } });
    }
  }, [router, user]);

  if (!user || (user.role === "student" && !user.email_verified)) return null;

  const isCollegeEmail = user.verification_method === "college_email";

  if (user.verification_status === "expired" && !user.reverification_email_verified) {
    const startRenewal = async () => {
      setRenewing(true);
      setRenewError(null);
      try {
        await apiStartReverification();
        await refreshUser();
      } catch (error) {
        setRenewError(toApiError(error).message);
      } finally {
        setRenewing(false);
      }
    };

    return (
      <VerificationShell
        eyebrow="RENEW YOUR STATUS"
        title="Keep your access active."
        subtitle="Confirm your email again, then refresh your student details."
        icon="shield-checkmark-outline"
      >
        <View style={styles.statusSurface}>
          <InfoCard
            icon="time-outline"
            tint="#FCD34D"
            text="Your previous student verification has expired."
          />
          {renewError ? (
            <InfoCard icon="alert-circle-outline" tint="#FCA5A5" text={renewError} error />
          ) : null}
          <LoginPrimaryButton
            label="Verify email and renew"
            onPress={() => void startRenewal()}
            loading={renewing}
          />
          <SecondaryAction
            label="Do it later"
            icon="arrow-forward-outline"
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
      </VerificationShell>
    );
  }

  if (user.verification_status === "pending") {
    return (
      <StatusScreen
        icon="time-outline"
        iconColor="#A78BFA"
        title="We’re reviewing it."
        body="Your documents are safely with our team. Review usually finishes within 24 hours, and we’ll email you when it’s done."
        action={{ label: "Explore while you wait", onPress: () => router.replace("/(tabs)") }}
      />
    );
  }

  if (user.verification_status === "approved") {
    return (
      <StatusScreen
        icon="checkmark-circle-outline"
        iconColor={color.success}
        title="You’re verified."
        body="Your student access is active and your digital card is ready."
        action={{ label: "Open student card", onPress: () => router.replace("/(tabs)/card") }}
      />
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!isCollegeEmail && (!collegeIdImage || !selfieImage)) {
      setFormError("Add both your college ID and a selfie holding it to continue.");
      return;
    }
    try {
      const result = await apiSubmitVerification({
        ...values,
        college_id_image: collegeIdImage,
        selfie_image: selfieImage,
      });
      if (!result.already_submitted) {
        await presentVerificationSubmittedNotification().catch(() => false);
      }
      await refreshUser();
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <VerificationShell
      eyebrow="STUDENT VERIFICATION"
      title="Unlock every deal."
      subtitle={
        isCollegeEmail
          ? "Your email is confirmed. Check your academic details to finish."
          : "A quick student check keeps Savvy deals exclusive to genuine students."
      }
      icon="shield-checkmark-outline"
    >
      <View style={styles.benefitsRow}>
        <Benefit icon="pricetag-outline" label="Claim deals" />
        <Benefit icon="card-outline" label="Student card" />
        <Benefit icon="sparkles-outline" label="Earn points" />
      </View>

      <InfoCard
        icon={isCollegeEmail ? "flash-outline" : "images-outline"}
        tint={isCollegeEmail ? "#86EFAC" : "#C4B5FD"}
        text={
          isCollegeEmail
            ? "Your college email means no document upload is needed."
            : "Upload both photos clearly. They are required for manual review."
        }
      />

      <View style={styles.formSurface}>
        {!isCollegeEmail ? (
          <View style={styles.uploadSection}>
            <View style={styles.sectionHeading}>
              <AppText style={styles.sectionNumber}>01</AppText>
              <View style={styles.sectionCopy}>
                <AppText variant="bodyMedium">Add verification photos</AppText>
                <AppText variant="caption" color={color.textTertiary}>
                  Make sure text and your face are easy to see.
                </AppText>
              </View>
            </View>
            <VerificationImagePicker
              label="College ID card"
              value={collegeIdImage}
              onChange={setCollegeIdImage}
              testID="verify-collegeid-input"
            />
            <VerificationImagePicker
              label="Selfie holding your college ID"
              value={selfieImage}
              onChange={setSelfieImage}
              testID="verify-selfie-input"
            />
          </View>
        ) : null}

        <View style={styles.detailsSection}>
          <View style={styles.sectionHeading}>
            <AppText style={styles.sectionNumber}>{isCollegeEmail ? "01" : "02"}</AppText>
            <View style={styles.sectionCopy}>
              <AppText variant="bodyMedium">Confirm student details</AppText>
              <AppText variant="caption" color={color.textTertiary}>
                All fields below are required.
              </AppText>
            </View>
          </View>
          <Controller
            control={control}
            name="college_name"
            render={({ field }) => (
              <LoginField
                label="College name"
                icon="school-outline"
                placeholder="Your college or university"
                autoCapitalize="words"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.college_name?.message}
                testID="verify-college-name-input"
              />
            )}
          />
          <Controller
            control={control}
            name="student_id_number"
            render={({ field }) => (
              <LoginField
                label="Student ID / Roll number"
                icon="id-card-outline"
                placeholder="Your student ID"
                autoCapitalize="characters"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.student_id_number?.message}
                testID="verify-student-id-input"
              />
            )}
          />
          <Controller
            control={control}
            name="course"
            render={({ field }) => (
              <LoginField
                label="Course"
                icon="book-outline"
                placeholder="e.g. B.Tech CSE"
                autoCapitalize="words"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.course?.message}
                testID="verify-course-input"
              />
            )}
          />
          <Controller
            control={control}
            name="year"
            render={({ field }) => (
              <LoginField
                label="Year of study"
                icon="calendar-outline"
                placeholder="e.g. 2nd year"
                autoCapitalize="sentences"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.year?.message}
                testID="verify-year-input"
              />
            )}
          />
        </View>

        {formError ? (
          <InfoCard icon="alert-circle-outline" tint="#FCA5A5" text={formError} error />
        ) : null}
        <LoginPrimaryButton
          label="Submit for verification"
          onPress={onSubmit}
          loading={isSubmitting}
        />
        <SecondaryAction
          label="Finish later"
          icon="arrow-forward-outline"
          onPress={() => router.replace("/(tabs)")}
        />
        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={14} color={color.textTertiary} />
          <AppText variant="caption" color={color.textTertiary} style={styles.privacyCopy}>
            Your documents stay private and are never shown to outlet partners.
          </AppText>
        </View>
      </View>
    </VerificationShell>
  );
}

function Benefit({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={17} color="#C4B5FD" />
      </View>
      <AppText variant="caption" color={color.textSecondary} style={styles.benefitLabel}>
        {label}
      </AppText>
    </View>
  );
}

function InfoCard({
  icon,
  tint,
  text,
  error = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  text: string;
  error?: boolean;
}) {
  return (
    <View
      style={[styles.infoCard, error && styles.errorCard]}
      accessibilityRole={error ? "alert" : undefined}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <AppText variant="small" color={tint} style={styles.infoCopy}>
        {text}
      </AppText>
    </View>
  );
}

function SecondaryAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
    >
      <AppText variant="small" color="#DDD6FE" style={styles.secondaryLabel}>
        {label}
      </AppText>
      <Ionicons name={icon} size={16} color="#B9B2FF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
  topRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSpacer: { width: 44 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(15,15,20,0.76)",
  },
  pressed: { opacity: 0.72 },
  intro: { alignItems: "center", marginTop: space.xl, marginBottom: space.lg },
  introMark: {
    width: 58,
    height: 58,
    marginBottom: space.md,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.32)",
    backgroundColor: "rgba(40,25,72,0.90)",
  },
  introAura: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(124,58,237,0.12)",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  eyebrow: { fontWeight: "800", letterSpacing: 1.6 },
  title: {
    marginTop: space.sm,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.65,
    textAlign: "center",
  },
  subtitle: { marginTop: space.sm, maxWidth: 380, textAlign: "center", lineHeight: 22 },
  benefitsRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  benefit: {
    flex: 1,
    minHeight: 78,
    padding: space.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: "rgba(12,12,17,0.86)",
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.14)",
  },
  benefitLabel: { textAlign: "center" },
  infoCard: {
    marginBottom: space.md,
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.18)",
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  errorCard: { borderColor: "rgba(239,68,68,0.30)", backgroundColor: "rgba(239,68,68,0.08)" },
  infoCopy: { flex: 1 },
  formSurface: {
    padding: space.md,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.16)",
    backgroundColor: "rgba(9,9,13,0.94)",
  },
  uploadSection: { gap: space.md },
  detailsSection: {
    gap: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sectionNumber: {
    width: 34,
    height: 34,
    paddingTop: 7,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C4B5FD",
    backgroundColor: "rgba(124,58,237,0.14)",
  },
  sectionCopy: { flex: 1, gap: 1 },
  secondaryButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  secondaryLabel: { fontWeight: "800" },
  privacyRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  privacyCopy: { flex: 1, lineHeight: 17 },
  statusSurface: {
    padding: space.lg,
    gap: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.16)",
    backgroundColor: "rgba(9,9,13,0.94)",
  },
  statusIcon: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
