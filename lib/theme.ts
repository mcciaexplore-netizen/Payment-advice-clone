import { ORG } from "@/lib/config";

/**
 * Colour accent, read from config/org.config.ts (the single place to
 * re-accent the app).
 *
 * - UI (Tailwind): `app/layout.tsx` writes these onto <html> as CSS variables;
 *   `app/globals.css` maps them to the `brand` / `forest` / `amber` utilities
 *   (e.g. `bg-brand`, `text-brand`, `border-brand/20`).
 * - PDFs, emails and the web manifest cannot read CSS variables, so they import
 *   THEME directly.
 */
export const THEME = ORG.theme;

export type Theme = typeof THEME;

/** Hex "#RRGGBB" -> "r g b" for rgb(r g b / alpha) usage. */
export function hexToRgbChannels(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}
