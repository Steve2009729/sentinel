// Single source of truth for the dashboard's dark fintech theme.
// Bloomberg-terminal-meets-Apple aesthetic.

export const theme = {
  // Backgrounds
  bg: "#06070D",
  bgGradient: "linear-gradient(135deg, #06070D 0%, #0B0E1A 50%, #0A0D18 100%)",
  panel: "#0D0F1A",
  panelAlt: "#111425",
  panelGlass: "rgba(13, 15, 26, 0.75)",
  surface: "#14172A",

  // Borders
  border: "#1C1F35",
  borderGlow: "rgba(0, 229, 160, 0.15)",

  // Text
  text: "#E6E8F0",
  textSecondary: "#B0B4C8",
  muted: "#6B7194",
  mutedLight: "#8A8FB3",

  // Primary accent — neon green
  accent: "#00E5A0",
  accentDim: "rgba(0, 229, 160, 0.12)",
  accentGlow: "0 0 20px rgba(0, 229, 160, 0.25)",

  // Action colors
  enter: "#00E5A0",
  watch: "#F5A623",
  skip: "#4B506B",

  // Tier colors
  tierBasic: "#5B8DEF",
  tierPremium: "#A855F7",
  tierDeep: "#F97316",

  // Status
  success: "#00E5A0",
  warning: "#F5A623",
  danger: "#EF4444",
  info: "#3B82F6",

  // Charts
  chartGreen: "#00E5A0",
  chartRed: "#EF4444",
  chartVolume: "rgba(0, 229, 160, 0.15)",
} as const;

export function actionColor(action: string): string {
  if (action === "ENTER") return theme.enter;
  if (action === "WATCH") return theme.watch;
  return theme.skip;
}

export function tierColor(tier: number): string {
  if (tier === 1) return theme.tierBasic;
  if (tier === 2) return theme.tierPremium;
  if (tier === 3) return theme.tierDeep;
  return theme.muted;
}

export function tierLabel(tier: number): string {
  if (tier === 1) return "Basic Signals";
  if (tier === 2) return "Premium Ratings";
  if (tier === 3) return "Deep Analytics";
  return "Unknown";
}
