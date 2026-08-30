import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

import { toApiError } from "@/api/errors";
import { apiStartReverification, apiSubmitVerification } from "@/api/verification";
import { AppText, Button, TextField } from "@/design-system/components";
import { AuthScaffold } from "@/components/AuthScaffold";
import { color, radius, space } from "@/design-system/tokens";
import { VerificationImagePicker } from "@/components/VerificationImagePicker";
import { useAuth } from "@/providers/AuthProvider";
import { verificationFormSchema, type VerificationFormValues } from "@/validation/verification";

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
    <AuthScaffold eyebrow="STUDENT VERIFICATION" title={title} subtitle={body} icon={icon} step={3}>
      <View style={styles.statusContent}>
        <View style={[styles.statusIcon, { borderColor: `${iconColor}4D` }]}>
          <Ionicons name={icon} size={30} color={iconColor} />
        </View>
        {action ? (
          <Button label={action.label} onPress={action.onPress} loading={action.loading} />
        ) : null}
      </View>
    </AuthScaffold>
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

  if (!user) return null;

  const isCollegeEmail = user.verification_method === "college_email";

  if (user.verification_status === "expired" && !user.reverification_email_verified) {
    const startRenewal = async () => {
      setRenewing(true);
      setRenewError(null);
      try {
        await apiStartReverification();
        await refreshUser();
        // useAuthGate redirects to (auth)/verify-otp once email_verified flips false.
      } catch (error) {
        setRenewError(toApiError(error).message);
      } finally {
        setRenewing(false);
      }
    };

    return (
      <AuthScaffold eyebrow="RENEW YOUR STATUS" title="Keep your student access active." subtitle="Verify your email again, then refresh your academic details." icon="shield-checkmark-outline" step={3} onBack={() => router.replace("/(tabs)")}>
        <View style={styles.statusContent}>
          <View style={[styles.statusIcon, { borderColor: "rgba(245,158,11,0.3)" }]}>
            <Ionicons name="shield-checkmark" size={30} color={color.amber} />
          </View>
          {renewError ? (
            <AppText variant="small" color={color.destructive} accessibilityRole="alert">
              {renewError}
            </AppText>
          ) : null}
          <Button label="Verify email and renew" onPress={startRenewal} loading={renewing} />
          <Button label="Do it later" variant="secondary" onPress={() => router.replace("/(tabs)")} />
        </View>
      </AuthScaffold>
    );
  }

  if (user.verification_status === "pending") {
    return (
      <StatusScreen
        icon="time"
        iconColor={color.primary}
        title="Verification submitted"
        body="Your documents have been received. Our team usually completes review within 24 hours — you'll get an email once it's done."
        action={{ label: "Explore while you wait", onPress: () => router.replace("/(tabs)") }}
      />
    );
  }

  if (user.verification_status === "approved") {
    return (
      <StatusScreen
        icon="checkmark-circle"
        iconColor={color.success}
        title="You're verified!"
        body="Your student pass is ready."
        action={{ label: "Go to your card", onPress: () => router.replace("/(tabs)/card") }}
      />
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!isCollegeEmail && (!collegeIdImage || !selfieImage)) {
      setFormError("Add both your college ID card and a selfie holding it to continue.");
      return;
    }
    try {
      await apiSubmitVerification({
        ...values,
        college_id_image: collegeIdImage,
        selfie_image: selfieImage,
      });
      await refreshUser();
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <AuthScaffold eyebrow="FINAL STEP" title="Unlock student-only access." subtitle={isCollegeEmail ? "Your college email is approved. Confirm your academic details to finish." : "Verify now for claiming and your digital card—or safely finish it later."} icon="shield-checkmark-outline" step={3} onBack={() => router.replace("/(tabs)")}>
        <View style={styles.benefitsRow}>
          <Benefit icon="ticket-outline" label="Claim deals" />
          <Benefit icon="card-outline" label="Student card" />
          <Benefit icon="sparkles-outline" label="Earn points" />
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name={isCollegeEmail ? "flash" : "images-outline"} size={18} color={isCollegeEmail ? color.success : color.amber} />
          <AppText variant="small" color={isCollegeEmail ? color.success : color.amber}>
            {isCollegeEmail
              ? "College email verification: no document uploads are needed."
              : "Documents required: both uploads are required for manual review."}
          </AppText>
        </View>

        <View style={styles.form}>
          {!isCollegeEmail ? (
            <>
              <VerificationImagePicker
                label="College ID card image"
                value={collegeIdImage}
                onChange={setCollegeIdImage}
                testID="verify-collegeid-input"
              />
              <VerificationImagePicker
                label="Selfie holding college ID card"
                value={selfieImage}
                onChange={setSelfieImage}
                testID="verify-selfie-input"
              />
            </>
          ) : null}

          <Controller
            control={control}
            name="college_name"
            render={({ field }) => (
              <TextField
                label="College name"
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
              <TextField
                label="Student ID / Roll number"
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
              <TextField
                label="Course (e.g. B.Tech CSE)"
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
              <TextField
                label="Year of study (e.g. 1st year)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.year?.message}
                testID="verify-year-input"
              />
            )}
          />

          {formError ? (
            <AppText variant="small" color={color.destructive} accessibilityRole="alert">
              {formError}
            </AppText>
          ) : null}

          <Button label="Submit for verification" onPress={onSubmit} loading={isSubmitting} />
          <Button label="Do it later" variant="secondary" onPress={() => router.replace("/(tabs)")} />
          <View style={styles.privacyRow}><Ionicons name="lock-closed-outline" size={14} color={color.textTertiary} /><AppText variant="caption" color={color.textTertiary} style={styles.privacyCopy}>Verification documents are protected and are never shown to outlet partners.</AppText></View>
        </View>
    </AuthScaffold>
  );
}

function Benefit({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return <View style={styles.benefit}><View style={styles.benefitIcon}><Ionicons name={icon} size={18} color="#B9B2FF" /></View><AppText variant="caption" color={color.textSecondary} style={styles.benefitLabel}>{label}</AppText></View>;
}

const styles = StyleSheet.create({
  statusContent: {
    alignItems: "center",
    paddingVertical: space.md,
    gap: space.md,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  form: { gap: space.md },
  benefitsRow: { flexDirection: "row", gap: space.sm },
  benefit: { flex: 1, minHeight: 88, padding: space.sm, alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.md, backgroundColor: color.surfaceMuted },
  benefitIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: color.primarySoft },
  benefitLabel: { textAlign: "center" },
  privacyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  privacyCopy: { flex: 1, lineHeight: 17 },
});
