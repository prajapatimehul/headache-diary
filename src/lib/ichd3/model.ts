// ICHD-3 typed data model (Zod v4 — root export `import { z } from 'zod'`).
//
// `z.infer` gives one type used by both IndexedDB (Entry → DiaryAggregate adapter)
// and the deterministic rule engine. Clinical-test fields default to
// not_tested/false so the engine conservatively returns NEEDS_TEST rather than
// fabricating a positive indomethacin / nerve-block result.
//
// Result vocabulary (Verdict, CriterionResult, DxResult) lives HERE per
// CONTRACT.md so the report agent can `import { ... } from "@/lib/ichd3/model"`.
// The engine re-exports them so existing engine imports keep working.

import { z } from "zod"; // zod@4.4.3 (root export)

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const Laterality = z.enum(["unilateral", "bilateral"]);
export const Quality = z.enum(["pulsating", "pressing_tightening", "stabbing", "other"]);
export const Nausea = z.enum(["none", "mild", "moderate", "severe"]);
export const PainRegion = z.enum([
  "orbital",
  "supraorbital",
  "temporal",
  "frontal",
  "occipital",
  "whole_head",
]);
export const AuraType = z.enum([
  "visual",
  "sensory",
  "speech_language",
  "motor",
  "brainstem",
  "retinal",
]);
export const BoutPattern = z.enum(["episodic", "chronic", "unknown"]);
export const OnsetPattern = z.enum([
  "daily_unremitting_from_onset_within_24h",
  "gradual",
  "unknown",
]);
export const MedClass = z.enum([
  "ergotamine",
  "triptan",
  "opioid",
  "combination_analgesic",
  "simple_nonopioid",
  "multiple_not_individually",
  "none",
]);
export const IndoResponse = z.enum(["absolute", "partial", "none", "not_tested"]);
export const TriState = z.enum(["yes", "no", "not_tested"]);

/* ------------------------------------------------------------------ */
/* Attack profile (the typical/modal attack the engine reasons over)   */
/* ------------------------------------------------------------------ */

/** The typical/modal attack profile the engine reasons over. */
export const AttackProfile = z.object({
  typicalDurationHours: z.number().min(0),
  minDurationHours: z.number().min(0), // shortest qualifying attack
  maxDurationHours: z.number().min(0), // longest qualifying attack
  laterality: Laterality,
  sideLocked: z.boolean(),
  quality: Quality,
  intensity0to10: z.number().int().min(0).max(10),
  aggravatedByRoutineActivity: z.boolean(),
  nausea: Nausea,
  vomiting: z.boolean(),
  photophobia: z.boolean(),
  phonophobia: z.boolean(),
  painRegions: z.array(PainRegion),
  // Aura
  auraPresent: z.boolean(),
  auraTypes: z.array(AuraType),
  auraFullyReversible: z.boolean(),
  auraSpreadsOver5min: z.boolean(),
  auraSymptomsInSuccession: z.boolean(),
  auraEachSymptom5to60min: z.boolean(),
  auraAtLeastOneUnilateral: z.boolean(),
  auraAtLeastOnePositive: z.boolean(),
  auraFollowedByHeadacheWithin60min: z.boolean(),
  // Autonomic (ipsilateral)
  conjunctivalInjectionOrLacrimation: z.boolean(),
  nasalCongestionOrRhinorrhoea: z.boolean(),
  eyelidOedema: z.boolean(),
  foreheadFacialSweating: z.boolean(),
  miosisOrPtosis: z.boolean(),
  restlessnessOrAgitation: z.boolean(),
  // Cervicogenic provocation
  neckRangeOfMotionReduced: z.boolean(),
  headacheWorsenedByNeckManoeuvres: z.boolean(),
});
export type AttackProfile = z.infer<typeof AttackProfile>;

/* ------------------------------------------------------------------ */
/* Diary aggregate (attack profile + monthly / course aggregates)      */
/* ------------------------------------------------------------------ */

export const DiaryAggregate = z.object({
  attack: AttackProfile,
  distinctAttackCount: z.number().int().min(0),
  headacheDaysPerMonth: z.number().min(0).max(31),
  migrainousDaysPerMonth: z.number().min(0).max(31),
  observationMonths: z.number().min(0),
  attackFrequencyPerDay: z.number().min(0),
  boutPattern: BoutPattern,
  onsetPattern: OnsetPattern,
  // Medication overuse
  acuteMedDaysPerMonth: z.number().min(0).max(31),
  medClass: MedClass,
  preExistingPrimaryHeadache: z.boolean(),
  // Clinical-test inputs (default not_tested/false -> drive NEEDS_TEST)
  indomethacinResponse: IndoResponse.default("not_tested"),
  cervicalImagingOrClinicalEvidence: z.boolean().default(false),
  nerveBlockAbolishesHeadache: TriState.default("not_tested"),
  // Clinician exclusion flag
  betterAccountedByOtherDx: z.boolean().default(false),
});
export type DiaryAggregate = z.infer<typeof DiaryAggregate>;

/* ------------------------------------------------------------------ */
/* Engine result vocabulary (authoritative location — CONTRACT §19-20) */
/* ------------------------------------------------------------------ */

/** Per-diagnosis outcome.
 *  - MET         : every required criterion (incl. attack-count) passes.
 *  - PROBABLE    : the precise ICHD 1.5 / 2.4 / 3.5 pattern (attack-count
 *                  shortfall or exactly one other criterion unmet). NOT fuzzy.
 *  - NOT_MET     : core criteria fail.
 *  - NEEDS_TEST  : diary-only data cannot satisfy a clinical-test criterion
 *                  (indomethacin trial, imaging/clinical evidence, nerve block).
 *                  PH 3.2 (crit E), HC 3.4 (crit D) and cervicogenic 11.2.1
 *                  (crit B + C4) CAP here — never auto-MET. */
export type Verdict = "MET" | "PROBABLE" | "NOT_MET" | "NEEDS_TEST";

export interface CriterionResult {
  id: string;
  text: string;
  passed: boolean;
  /** Human-readable reason — carries the actual measured value when failed. */
  reason?: string;
}

export interface DxResult {
  /** Official ICHD-3 code, e.g. "1.1", "2.3", "8.2.2". */
  code: string;
  /** Human-readable diagnosis name. */
  name: string;
  verdict: Verdict;
  /** Per-criterion pass/fail with measured values. */
  criteria: CriterionResult[];
  /** IDs of unmet criteria. */
  missing: string[];
  /** Present when verdict === 'NEEDS_TEST' — describes the gating clinical test. */
  needsTest?: string;
}
