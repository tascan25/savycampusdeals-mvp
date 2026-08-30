import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { AppText, Button, Screen, TextField } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

type ProfileForm = { name: string; college: string; course: string; year: string; phone: string };

export default function ProfileDetailsScreen() {
  const { user, updateProfile } = useAuth();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    defaultValues: { name: user?.name ?? "", college: user?.college ?? "", course: user?.course ?? "", year: user?.year ?? "", phone: user?.phone ?? "" },
  });
  if (!user) return null;

  const save = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await updateProfile({ name: values.name.trim(), college: values.college.trim(), course: values.course.trim(), year: values.year.trim(), phone: values.phone.trim() });
      setMessage({ text: "Your profile is up to date.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Couldn't save your profile.", error: true });
    }
  });

  return <Screen edges={["bottom"]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <AppText variant="h1">Your details</AppText>
          <AppText variant="body" color={color.textSecondary}>Keep these accurate so your membership and nearby offers stay relevant.</AppText>
        </View>
        <View style={styles.form}>
          <Controller control={control} name="name" rules={{ required: "Enter your full name", minLength: { value: 2, message: "Enter at least 2 characters" } }} render={({ field }) => <TextField label="Full name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} autoCapitalize="words" />} />
          <Controller control={control} name="college" render={({ field }) => <TextField label="College" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoCapitalize="words" />} />
          <View style={styles.row}>
            <View style={styles.rowField}><Controller control={control} name="course" render={({ field }) => <TextField label="Course" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoCapitalize="words" />} /></View>
            <View style={styles.rowField}><Controller control={control} name="year" render={({ field }) => <TextField label="Year" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />} /></View>
          </View>
          <Controller control={control} name="phone" render={({ field }) => <TextField label="Phone" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="phone-pad" autoComplete="tel" />} />
        </View>
        {message ? <AppText variant="small" color={message.error ? color.destructive : color.success} accessibilityRole="alert">{message.text}</AppText> : null}
        <Button label="Save changes" onPress={save} loading={isSubmitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl }, intro: { gap: space.xs }, form: { gap: space.md }, row: { flexDirection: "row", gap: space.md }, rowField: { flex: 1 },
});
