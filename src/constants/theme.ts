/**
 * Cinematic Dark — Actors and Artists AI Studios
 * Use with Tailwind tokens (see app/globals.css @theme) or inline when needed.
 */
export const theme = {
  black: "#000000",
  charcoal: "#121212",
  metallicOrange: "#FF8C00",
} as const;

export type ThemeColors = typeof theme;
