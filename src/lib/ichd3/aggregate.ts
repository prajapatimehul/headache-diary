// Entry[] -> DiaryAggregate adapter (BLUEPRINT §7).
//
// Bridges the stored Dexie `Entry` history (snake_case, daily-UX shaped) into the
// engine's `DiaryAggregate` (camelCase, ICHD-3 shaped), validates at the boundary
// with Zod, then runs classify(). The engine reads ONLY structured fields here —
// never the free-text `note` (CONTRACT: free text is UX only, must never change a
// verdict, and protects multilingual Hinglish/Devanagari notes from mis-parsing).
//
// The course/monthly aggregates (headache-days/month, attack count, med-days,
// observation window) and the "typical attack" profile are COMPUTED here from the
// full history — NOT read from the per-entry snapshot (those are written as 0 by
// the form). Earlier this file trusted the per-entry zeros, which silently forced
// every monthly criterion (chronic migraine, MOH, NDPH…) to NOT_MET. See
// courseAggregates() and typicalAttack() below.
//
// NOTE on imports: engine.ts also imports toAggregate from this file (for
// progressiveInsight). The cycle is safe because every reference is inside a
// function body, never at module-eval time.

import type { Entry } from "@/lib/db";
import { DiaryAggregate, PainRegion, AuraType } from "./model";
import { classify } from "./engine";
import type { DxResult } from "./model";

/* ------------------------------------------------------------------ */
/* Small aggregation helpers                                           */
/* ------------------------------------------------------------------ */

/** Whole-day difference b - a (both "YYYY-MM-DD"); NaN-safe -> 0. */
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Most frequent defined value; `fallback` when none present. */
function modeOf<T extends string>(vals: (T | undefined | null)[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const v of vals) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

/** Items present on >= 1/3 of the supplied days, restricted to a valid enum set. */
function commonItems<T extends string>(
  perDay: (readonly string[] | undefined)[],
  valid: readonly T[],
): T[] {
  const days = perDay.length || 1;
  const counts = new Map<string, number>();
  for (const arr of perDay)
    for (const x of new Set(arr ?? [])) counts.set(x, (counts.get(x) ?? 0) + 1);
  return valid.filter((v) => (counts.get(v) ?? 0) * 3 >= days);
}

/** A day's intensity, preferring the explicit attack intensity, then worst. */
function dayIntensity(e: Entry): number {
  const raw = e.intensity ?? e.worst ?? 0;
  return Math.max(0, Math.min(10, Math.round(raw)));
}

/** ICHD "migrainous day" proxy — kept identical to the Cause Finder predicate. */
function isMigrainousDay(e: Entry): boolean {
  return (
    e.quality === "pulsating" &&
    dayIntensity(e) >= 6 &&
    (e.nausea !== "none" || (e.photophobia && e.phonophobia))
  );
}

/** A day on which any acute medication was taken. */
function hasAcuteMed(e: Entry): boolean {
  return (e.meds?.length ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* Course / monthly aggregates computed from the whole history         */
/* ------------------------------------------------------------------ */

export interface CourseAggregates {
  /** Distinct headache days logged (proxy for distinct attacks). */
  distinctAttackCount: number;
  /** Headache days in the trailing 30-day window (conservative, no extrapolation). */
  headacheDaysPerMonth: number;
  /** Migrainous days in the trailing 30-day window. */
  migrainousDaysPerMonth: number;
  /** Total observation span in months (last logged date - first, in 30-day units). */
  observationMonths: number;
  /** Acute-medication days in the trailing 30-day window. */
  acuteMedDaysPerMonth: number;
}

const EMPTY_COURSE: CourseAggregates = {
  distinctAttackCount: 0,
  headacheDaysPerMonth: 0,
  migrainousDaysPerMonth: 0,
  observationMonths: 0,
  acuteMedDaysPerMonth: 0,
};

/**
 * Derive the monthly/course numbers ICHD-3 thresholds depend on, from the full
 * entry history. "Per month" = a real trailing 30-day count anchored at the most
 * recent logged date (deliberately conservative: sparse data under-counts rather
 * than over-diagnosing chronic/MOH). De-duplicated by date so accidental
 * same-day duplicates can't inflate counts.
 */
export function courseAggregates(entries: Entry[]): CourseAggregates {
  const headacheDays = entries.filter((e) => !e.no_headache);
  if (headacheDays.length === 0) return EMPTY_COURSE;

  const allDates = entries.map((e) => e.date).sort();
  const first = allDates[0];
  const last = allDates[allDates.length - 1];
  const spanDays = Math.max(1, dayDiff(first, last) + 1);

  // Trailing 30-day window [last-29, last].
  const inWindow = (e: Entry) => {
    const d = dayDiff(e.date, last);
    return d >= 0 && d <= 29;
  };
  const distinctDates = (es: Entry[]) => new Set(es.map((e) => e.date)).size;

  const hdWindow = headacheDays.filter(inWindow);
  return {
    distinctAttackCount: distinctDates(headacheDays),
    headacheDaysPerMonth: Math.min(31, distinctDates(hdWindow)),
    migrainousDaysPerMonth: Math.min(
      31,
      distinctDates(hdWindow.filter(isMigrainousDay)),
    ),
    observationMonths: spanDays / 30,
    acuteMedDaysPerMonth: Math.min(
      31,
      distinctDates(entries.filter((e) => inWindow(e) && hasAcuteMed(e))),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Typical ("modal") attack profile                                    */
/* ------------------------------------------------------------------ */

/**
 * Build the representative attack the engine reasons over, from ALL headache
 * days — not whichever day happened to be logged last. Categorical fields use the
 * mode, numeric fields the median, booleans the majority. This makes verdicts
 * stable day-to-day instead of flipping on a single atypical entry.
 */
function typicalAttack(headacheDays: Entry[]) {
  const n = headacheDays.length || 1;
  const maj = (pred: (e: Entry) => boolean) =>
    headacheDays.filter(pred).length * 2 > n;

  const durations = headacheDays
    .map((e) => e.duration_hours)
    .filter((x): x is number => typeof x === "number" && x > 0);
  const typicalDuration = median(durations);

  const auraDays = headacheDays.filter((e) => e.aura);
  const auraMaj = (pred: (e: Entry) => boolean) =>
    auraDays.length > 0 && auraDays.filter(pred).length * 2 > auraDays.length;

  return {
    typicalDurationHours: typicalDuration,
    minDurationHours: durations.length ? Math.min(...durations) : typicalDuration,
    maxDurationHours: durations.length ? Math.max(...durations) : typicalDuration,
    laterality: modeOf<"unilateral" | "bilateral">(
      headacheDays.map((e) => e.laterality),
      "bilateral",
    ),
    sideLocked: maj((e) => e.side_locked),
    quality: modeOf<"pulsating" | "pressing_tightening" | "stabbing" | "other">(
      headacheDays.map((e) => e.quality),
      "other",
    ),
    intensity0to10: Math.round(median(headacheDays.map(dayIntensity))),
    aggravatedByRoutineActivity: maj((e) => e.aggravated_by_activity),
    nausea: modeOf<"none" | "mild" | "moderate" | "severe">(
      headacheDays.map((e) => e.nausea),
      "none",
    ),
    vomiting: maj((e) => e.vomiting),
    photophobia: maj((e) => e.photophobia),
    phonophobia: maj((e) => e.phonophobia),
    painRegions: commonItems(
      headacheDays.map((e) => e.pain_regions),
      PainRegion.options,
    ),
    // Aura — present if the majority of days have aura; sub-features taken over aura days.
    auraPresent: maj((e) => e.aura),
    auraTypes: commonItems(
      auraDays.map((e) => e.aura_types),
      AuraType.options,
    ),
    auraFullyReversible: auraMaj((e) => e.aura_fully_reversible),
    auraSpreadsOver5min: auraMaj((e) => e.aura_spreads_over_5min),
    auraSymptomsInSuccession: auraMaj((e) => e.aura_symptoms_in_succession),
    auraEachSymptom5to60min: auraMaj((e) => e.aura_each_5to60min),
    auraAtLeastOneUnilateral: auraMaj((e) => e.aura_at_least_one_unilateral),
    auraAtLeastOnePositive: auraMaj((e) => e.aura_at_least_one_positive),
    auraFollowedByHeadacheWithin60min: auraMaj(
      (e) => e.aura_followed_by_headache_60min,
    ),
    // Autonomic (ipsilateral) — majority across headache days.
    conjunctivalInjectionOrLacrimation: maj(
      (e) => e.conjunctival_injection_or_lacrimation,
    ),
    nasalCongestionOrRhinorrhoea: maj((e) => e.nasal_congestion_or_rhinorrhoea),
    eyelidOedema: maj((e) => e.eyelid_oedema),
    foreheadFacialSweating: maj((e) => e.forehead_facial_sweating),
    miosisOrPtosis: maj((e) => e.miosis_or_ptosis),
    restlessnessOrAgitation: maj((e) => e.restlessness_or_agitation),
    // Cervicogenic provocation.
    neckRangeOfMotionReduced: maj((e) => e.neck_range_of_motion_reduced),
    headacheWorsenedByNeckManoeuvres: maj(
      (e) => e.headache_worsened_by_neck_manoeuvres,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

/** Build the engine input from the full entry history + the typical attack. */
export function toAggregate(entries: Entry[]): DxResult[] | null {
  const headacheDays = entries.filter((e) => !e.no_headache);
  if (headacheDays.length === 0) return null;

  // Clinical-test inputs and slow-changing flags are carried on each entry; take
  // the most recent headache day for those (they don't vary attack-to-attack).
  const latest = headacheDays[headacheDays.length - 1];
  const course = courseAggregates(entries);

  const input = {
    attack: typicalAttack(headacheDays),
    distinctAttackCount: course.distinctAttackCount,
    headacheDaysPerMonth: course.headacheDaysPerMonth,
    migrainousDaysPerMonth: course.migrainousDaysPerMonth,
    observationMonths: course.observationMonths,
    // Intra-day attack frequency can't be inferred from a daily diary — leave honest.
    attackFrequencyPerDay: latest.attack_frequency_per_day ?? 0,
    boutPattern: latest.bout_pattern,
    onsetPattern: latest.onset_pattern,
    acuteMedDaysPerMonth: course.acuteMedDaysPerMonth,
    medClass: latest.med_class,
    preExistingPrimaryHeadache: latest.pre_existing_primary_headache,
    indomethacinResponse: latest.indomethacin_response,
    cervicalImagingOrClinicalEvidence:
      latest.cervical_imaging_or_clinical_evidence,
    nerveBlockAbolishesHeadache: latest.nerve_block_abolishes_headache,
    betterAccountedByOtherDx: latest.better_accounted_by_other_dx,
  };

  const parsed = DiaryAggregate.parse(input); // validate boundary (throws on malformed input)
  return classify(parsed); // DxResult[]
}
