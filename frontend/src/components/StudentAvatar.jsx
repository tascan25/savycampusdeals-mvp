import React from "react";

export const STUDENT_AVATARS = [
  { key: "campus_cat", label: "Navy cap", src: "/images/avatars/campus-cap.png" },
  { key: "cosmic_rocket", label: "Round glasses", src: "/images/avatars/round-glasses.png" },
  { key: "chill_ghost", label: "Cool shades", src: "/images/avatars/cool-shades.png" },
  { key: "study_bird", label: "Coral cap", src: "/images/avatars/coral-cap.png" },
  { key: "music_wave", label: "Violet shades", src: "/images/avatars/violet-shades.png" },
  { key: "game_mode", label: "Clear frames", src: "/images/avatars/clear-frames.png" },
  { key: "green_leaf", label: "Headphones", src: "/images/avatars/headphones.png" },
  { key: "lucky_star", label: "Beanie", src: "/images/avatars/beanie.png" },
];

export function getStudentAvatar(avatarKey) {
  return STUDENT_AVATARS.find((avatar) => avatar.key === avatarKey) || null;
}

export default function StudentAvatar({ avatarKey, name, size = 36, className = "" }) {
  const avatar = getStudentAvatar(avatarKey);
  const initial = (name || "S").trim().charAt(0).toUpperCase() || "S";

  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      {avatar ? (
        <img src={avatar.src} alt="" draggable="false" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display font-bold" style={{ fontSize: Math.round(size * 0.38) }}>{initial}</span>
      )}
    </span>
  );
}
