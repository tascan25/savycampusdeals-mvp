/**
 * Restrained native dark theme. Same brand family as the website's
 * design_guidelines.json (indigo primary, near-black ground) but deliberately
 * toned down for mobile: no glassmorphism, no ambient glow, minimal borders.
 * Brand recognition comes from type/color/shape/motion, not from repeating
 * the logo — see mobile/docs/architecture.md "Brand usage" for the rule.
 */

export const color = {
  background: "#050505",
  surface: "#0C0C0F",
  surfaceMuted: "#101014",
  surfaceElevated: "#15151B",
  border: "rgba(255,255,255,0.075)",
  borderStrong: "rgba(255,255,255,0.14)",
  borderFocus: "#4F46E5",

  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textTertiary: "#71717A",

  primary: "#4F46E5",
  primaryPressed: "#4338CA",
  primarySoft: "rgba(79,70,229,0.14)",
  primaryGlow: "rgba(99,102,241,0.28)",
  purple: "#9333EA",

  success: "#22C55E",
  amber: "#F59E0B",
  destructive: "#EF4444",
  destructivePressed: "#DC2626",

  onPrimary: "#FFFFFF",
  onSurface: "#FFFFFF",
} as const;

/** 8-point spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 38, lineHeight: 43, fontWeight: "800" as const, letterSpacing: -1.2 },
  h1: { fontSize: 32, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.7 },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const, letterSpacing: -0.35 },
  h3: { fontSize: 19, lineHeight: 24, fontWeight: "700" as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  bodyMedium: { fontSize: 16, lineHeight: 22, fontWeight: "500" as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
};

/** Minimum touch target, per accessibility requirement. */
export const minTouchTarget = 44;

export const motion = {
  fast: 150,
  base: 220,
};
