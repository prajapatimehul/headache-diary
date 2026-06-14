// Cause Finder — the "profile": stable / contextual answers that don't change
// day-to-day (positional pattern, jaw, hypermobility, prior workup, treatments
// tried, red-flag context). Stored separately from daily entries so logging
// stays fast. localStorage, SSR-guarded (mirrors lib/report/range-store).

export type TestState = "not_done" | "normal" | "abnormal";

export interface PriorWorkup {
  brainMRI: TestState;
  ctSinus: TestState;
  eyeExamIOP: TestState; // intra-ocular pressure / dilated eye exam
  bloods: TestState;
  sleepStudy: TestState;
  cervicalImaging: TestState;
  nerveBlock: TestState; // diagnostic occipital / C2-C3 block
  indomethacinTrial: TestState;
  lumbarPuncture: TestState; // opening pressure (IIH / SIH)
}

export interface CauseProfile {
  // --- positional / pressure ---
  positional: "none" | "worse_upright" | "worse_lying" | "worse_valsalva" | "unknown";
  pulsatileTinnitus: boolean; // whooshing in the ear
  // --- jaw / dental ---
  jawClickOrPainChewing: boolean;
  bruxism: boolean; // teeth grinding / morning jaw tightness
  // --- connective tissue ---
  hypermobile: boolean;
  // --- context ---
  recentHeadNeckTrauma: boolean;
  recentRespiratoryInfection: boolean;
  pregnant: boolean;
  newOnsetOver50: boolean;
  // --- eye ---
  eyeRednessHalos: boolean; // acute angle-closure glaucoma signal
  transientVisualObscurations: boolean; // IIH signal
  visionLossOrField: boolean; // red flag
  // --- systemic / danger ---
  feverOrSystemic: boolean;
  cancerHistory: boolean;
  immuneCompromise: boolean;
  thunderclapEver: boolean; // reached worst intensity in <1 min
  neuroDeficit: boolean; // weakness, numbness, speech, confusion (not aura)
  // --- sinus ---
  facialPressureCongestion: boolean;
  // --- treatments already tried (to detect mismatch / treadmill) ---
  treatmentsTried: string[]; // e.g. "triptan","cgrp","amitriptyline","botox","nerve_block","physio","nsaid"
  // --- prior workup ---
  workup: PriorWorkup;
  // --- disability (HIT-6: 36-78) ---
  hit6?: number;
}

const KEY = "hd-cause-profile";

export function blankWorkup(): PriorWorkup {
  return {
    brainMRI: "not_done",
    ctSinus: "not_done",
    eyeExamIOP: "not_done",
    bloods: "not_done",
    sleepStudy: "not_done",
    cervicalImaging: "not_done",
    nerveBlock: "not_done",
    indomethacinTrial: "not_done",
    lumbarPuncture: "not_done",
  };
}

export function blankProfile(): CauseProfile {
  return {
    positional: "unknown",
    pulsatileTinnitus: false,
    jawClickOrPainChewing: false,
    bruxism: false,
    hypermobile: false,
    recentHeadNeckTrauma: false,
    recentRespiratoryInfection: false,
    pregnant: false,
    newOnsetOver50: false,
    eyeRednessHalos: false,
    transientVisualObscurations: false,
    visionLossOrField: false,
    feverOrSystemic: false,
    cancerHistory: false,
    immuneCompromise: false,
    thunderclapEver: false,
    neuroDeficit: false,
    facialPressureCongestion: false,
    treatmentsTried: [],
    workup: blankWorkup(),
  };
}

export function loadProfile(): CauseProfile {
  if (typeof window === "undefined") return blankProfile();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blankProfile();
    // merge over blank so older saved profiles gain new fields
    const saved = JSON.parse(raw) as Partial<CauseProfile>;
    return {
      ...blankProfile(),
      ...saved,
      workup: { ...blankWorkup(), ...(saved.workup ?? {}) },
      treatmentsTried: saved.treatmentsTried ?? [],
    };
  } catch {
    return blankProfile();
  }
}

export function saveProfile(p: CauseProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — ignore */
  }
}
