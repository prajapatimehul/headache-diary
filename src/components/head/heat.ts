import * as THREE from "three";

/**
 * Pain-heat ramp (0..10) using the design system's --h0..--h10 scale.
 *
 * DESIGN.md: "Cool, calm UI. Warm = pain." Heat is the ONLY warm range in the
 * product — a continuous gradient teal -> amber -> coral -> red mapped to 0-10.
 *
 * The canonical stops live in globals.css as CSS custom properties (--h0..--h10).
 * We read them at runtime so the 3D head stays in lock-step with the 2D UI, and
 * fall back to the exact globals.css hex values when CSS vars aren't available
 * (SSR, workers, tests). Each stop is parsed once and cached.
 */

// Exact mirror of globals.css :root { --h0 .. --h10 } so three.js Color and any
// non-DOM context resolve identical colors to the rest of the app.
const HEAT_STOPS_FALLBACK: readonly string[] = [
  "#3a4750", // --h0  calm slate (no/low pain)
  "#38938a", // --h1
  "#3fb8a6", // --h2  seafoam
  "#6fc98f", // --h3
  "#e8c15a", // --h4  amber
  "#e8b14e", // --h5
  "#e89b43", // --h6  orange
  "#e57f45", // --h7
  "#e0654b", // --h8  coral
  "#db4642", // --h9
  "#d7263d", // --h10 red (urgent)
] as const;

let cachedStops: string[] | null = null;

/** Resolve the 11 heat stops from CSS vars once, falling back to the literals. */
function resolveStops(): string[] {
  if (cachedStops) return cachedStops;
  if (typeof window !== "undefined" && typeof getComputedStyle === "function") {
    try {
      const cs = getComputedStyle(document.documentElement);
      const fromCss = HEAT_STOPS_FALLBACK.map((fallback, i) => {
        const v = cs.getPropertyValue(`--h${i}`).trim();
        return v.length > 0 ? v : fallback;
      });
      cachedStops = fromCss;
      return fromCss;
    } catch {
      // ignore — fall through to literals
    }
  }
  // Don't cache the fallback during SSR; CSS vars may resolve on the client later.
  return HEAT_STOPS_FALLBACK as unknown as string[];
}

// Pre-parsed THREE.Color per stop, lazily built so module import is cheap.
let parsedColors: THREE.Color[] | null = null;
function stopColors(): THREE.Color[] {
  if (parsedColors) return parsedColors;
  const stops = resolveStops();
  const colors = stops.map((s) => new THREE.Color(s));
  // Only persist once the DOM-resolved values are in hand.
  if (cachedStops) parsedColors = colors;
  return colors;
}

/**
 * Continuous interpolated heat color across the 11 stops (0..10).
 * Returns a CSS rgb() string (usable in DOM and as a three.js Color input).
 * Interpolation happens in linear space for a smooth, non-muddy ramp.
 */
export function heatColor(intensity: number): string {
  return heatThree(intensity).getStyle();
}

/** Same ramp as heatColor() but returns a THREE.Color (no string round-trip). */
export function heatThree(intensity: number): THREE.Color {
  const t = THREE.MathUtils.clamp(intensity, 0, 10);
  const colors = stopColors();
  const lo = Math.floor(t);
  const hi = Math.min(lo + 1, 10);
  const frac = t - lo;
  // lerpColors mutates the target; clone so cached stop colors stay pristine.
  const out = colors[lo].clone();
  if (frac > 0) out.lerp(colors[hi], frac);
  return out;
}

/** Discrete stop color for a given index 0..10 (e.g. legends, swatches). */
export function heatStop(i: number): string {
  const idx = THREE.MathUtils.clamp(Math.round(i), 0, 10);
  return resolveStops()[idx];
}

/** The full 11-stop ramp as CSS strings (for building 2D gradients / legends). */
export function heatRamp(): string[] {
  return resolveStops().slice();
}
