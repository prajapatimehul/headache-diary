// Tiny localStorage bridge so the setup page can hand the chosen DateRange to the
// print route (which loads in its own minimal layout). Client-only.
import type { DateRange } from "./types";

const KEY = "hd.report.range";

export function saveRange(range: DateRange): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(range));
  } catch {
    // storage may be unavailable (private mode quota); print falls back to last30.
  }
}

export function loadRange(): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DateRange;
    if (parsed && typeof parsed.kind === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}
