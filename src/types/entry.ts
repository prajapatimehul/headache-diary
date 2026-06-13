/**
 * Symptom option lists for the diary form.
 *
 * These are the *display* sources for the chips / segmented controls in
 * `EntryForm`. The canonical `Entry` shape lives in `@/lib/db` (do NOT redefine
 * it here — only the option vocabularies). Every value below maps 1:1 to the
 * enum constraints in the SQL migration (BLUEPRINT §5) and the Dexie `Entry`
 * field types (BLUEPRINT §6 / §lib-db).
 *
 * All free-text inputs accept Devanagari / Hinglish (UTF-8) — nothing here
 * restricts input.
 */

export interface Option<V extends string = string> {
  value: V;
  label: string;
  /** optional helper line shown under the label */
  hint?: string;
}

/* ---------------------------------------------------------------- attack -- */

export type QualityValue =
  | "pulsating"
  | "pressing_tightening"
  | "stabbing"
  | "other";

export const QUALITY_OPTIONS: Option<QualityValue>[] = [
  { value: "pulsating", label: "Throbbing", hint: "pulsating / pounding" },
  { value: "pressing_tightening", label: "Pressing", hint: "tight band / squeeze" },
  { value: "stabbing", label: "Stabbing", hint: "sharp / piercing" },
  { value: "other", label: "Other" },
];

export type LateralityValue = "unilateral" | "bilateral";

export const LATERALITY_OPTIONS: Option<LateralityValue>[] = [
  { value: "unilateral", label: "One side" },
  { value: "bilateral", label: "Both sides" },
];

export type NauseaValue = "none" | "mild" | "moderate" | "severe";

export const NAUSEA_OPTIONS: Option<NauseaValue>[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

/**
 * "When / triggers" — UX surface for what surrounds an attack. Stored in the
 * free-text `meds`/`note` UX layer is NOT correct here; these feed nothing in
 * the engine directly, they are quick context chips. Kept minimal + neutral.
 */
export const WHEN_OPTIONS: Option[] = [
  { value: "on_waking", label: "On waking" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night / woke me up" },
  { value: "with_period", label: "Around period" },
];

/** Things that made it WORSE (UX context chips). */
export const WORSE_OPTIONS: Option[] = [
  { value: "movement", label: "Movement" },
  { value: "light", label: "Bright light" },
  { value: "sound", label: "Loud sound" },
  { value: "smell", label: "Strong smell" },
  { value: "screen", label: "Screens" },
  { value: "bending", label: "Bending over" },
  { value: "coughing", label: "Coughing / strain" },
  { value: "stress", label: "Stress" },
];

/** Things that made it BETTER (UX context chips). */
export const BETTER_OPTIONS: Option[] = [
  { value: "rest", label: "Rest" },
  { value: "sleep", label: "Sleep" },
  { value: "dark_room", label: "Dark room" },
  { value: "medication", label: "Medication" },
  { value: "cold_pack", label: "Cold pack" },
  { value: "caffeine", label: "Caffeine" },
  { value: "water", label: "Water / food" },
  { value: "fresh_air", label: "Fresh air" },
];

/* ----------------------------------------------------------- autonomic --- */

/**
 * Each value is the `Entry` boolean field it toggles. EntryForm maps the
 * selected set back onto the individual booleans.
 */
export type AutonomicField =
  | "conjunctival_injection_or_lacrimation"
  | "nasal_congestion_or_rhinorrhoea"
  | "eyelid_oedema"
  | "forehead_facial_sweating"
  | "miosis_or_ptosis"
  | "restlessness_or_agitation";

export const AUTONOMIC_OPTIONS: Option<AutonomicField>[] = [
  {
    value: "conjunctival_injection_or_lacrimation",
    label: "Red / watery eye",
    hint: "same side as pain",
  },
  {
    value: "nasal_congestion_or_rhinorrhoea",
    label: "Blocked / runny nose",
    hint: "same side as pain",
  },
  { value: "eyelid_oedema", label: "Swollen eyelid", hint: "same side" },
  { value: "forehead_facial_sweating", label: "Forehead sweating" },
  { value: "miosis_or_ptosis", label: "Drooping / small pupil", hint: "same side" },
  { value: "restlessness_or_agitation", label: "Restless / can't sit still" },
];

/** Convenience: the autonomic-eye/nose subset (the "nose" group asked for). */
export const NOSE_OPTIONS: Option<AutonomicField>[] = AUTONOMIC_OPTIONS.filter(
  (o) =>
    o.value === "nasal_congestion_or_rhinorrhoea" ||
    o.value === "conjunctival_injection_or_lacrimation",
);

/* ---------------------------------------------------------------- aura ---- */

export type AuraTypeValue =
  | "visual"
  | "sensory"
  | "speech_language"
  | "motor"
  | "brainstem"
  | "retinal";

export const AURA_TYPE_OPTIONS: Option<AuraTypeValue>[] = [
  { value: "visual", label: "Visual", hint: "zig-zags, flashes, blind spot" },
  { value: "sensory", label: "Tingling / numbness" },
  { value: "speech_language", label: "Speech / language" },
  { value: "motor", label: "Weakness", hint: "rare" },
  { value: "brainstem", label: "Brainstem", hint: "vertigo, double vision" },
  { value: "retinal", label: "One-eye vision loss" },
];

/* ---------------------------------------------------------------- meds ---- */

/**
 * Quick-pick acute medications. Free; the actual MOH-relevant classification
 * is `med_class` (settings / derived). `meds_other` holds any-language text.
 */
export const MEDS_OPTIONS: Option[] = [
  { value: "paracetamol", label: "Paracetamol" },
  { value: "ibuprofen", label: "Ibuprofen" },
  { value: "aspirin", label: "Aspirin" },
  { value: "naproxen", label: "Naproxen" },
  { value: "combination", label: "Combination tablet" },
  { value: "triptan", label: "Triptan", hint: "sumatriptan, etc." },
  { value: "ergotamine", label: "Ergotamine" },
  { value: "opioid", label: "Opioid / codeine" },
];

export type MedClassValue =
  | "ergotamine"
  | "triptan"
  | "opioid"
  | "combination_analgesic"
  | "simple_nonopioid"
  | "multiple_not_individually"
  | "none";

export const MED_CLASS_OPTIONS: Option<MedClassValue>[] = [
  { value: "none", label: "None" },
  { value: "simple_nonopioid", label: "Simple painkiller", hint: "paracetamol / NSAID" },
  { value: "triptan", label: "Triptan" },
  { value: "ergotamine", label: "Ergotamine" },
  { value: "opioid", label: "Opioid" },
  { value: "combination_analgesic", label: "Combination analgesic" },
  { value: "multiple_not_individually", label: "Multiple classes" },
];

/* --------------------------------------------------------------- onset ---- */

export type OnsetPatternValue =
  | "daily_unremitting_from_onset_within_24h"
  | "gradual"
  | "unknown";

export const ONSET_PATTERN_OPTIONS: Option<OnsetPatternValue>[] = [
  { value: "unknown", label: "Not sure" },
  { value: "gradual", label: "Came on gradually" },
  {
    value: "daily_unremitting_from_onset_within_24h",
    label: "Daily from a clear start day",
    hint: "became constant within 24h and never stopped",
  },
];
