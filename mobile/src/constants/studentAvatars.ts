export const STUDENT_AVATARS = [
  { key: "campus_cat", label: "Navy cap", path: "/images/avatars/campus-cap.png" },
  { key: "cosmic_rocket", label: "Round glasses", path: "/images/avatars/round-glasses.png" },
  { key: "chill_ghost", label: "Cool shades", path: "/images/avatars/cool-shades.png" },
  { key: "study_bird", label: "Coral cap", path: "/images/avatars/coral-cap.png" },
  { key: "music_wave", label: "Violet shades", path: "/images/avatars/violet-shades.png" },
  { key: "game_mode", label: "Clear frames", path: "/images/avatars/clear-frames.png" },
  { key: "green_leaf", label: "Headphones", path: "/images/avatars/headphones.png" },
  { key: "lucky_star", label: "Beanie", path: "/images/avatars/beanie.png" },
] as const;

export function getStudentAvatar(avatarKey: string | null | undefined) {
  return STUDENT_AVATARS.find((avatar) => avatar.key === avatarKey) ?? null;
}
