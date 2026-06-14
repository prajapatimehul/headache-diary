// Cause Finder — shared types.
//
// The Cause Finder sits ON TOP of the ICHD-3 engine (src/lib/ichd3). The ICHD-3
// engine answers "which primary-headache criteria are met"; the Cause Finder
// answers the patient's real questions: "what could be causing this (incl.
// secondary/fixable causes the standard visit misses), what's the right next
// test + specialist, and is anything dangerous?" Decision support — not a dx.

export type Urgency = "emergency" | "urgent" | "routine";

export type CauseCategory =
  | "primary" // primary headache disorder (migraine, TTH, cluster...)
  | "secondary" // caused by something else (sinus, eye, neck, CSF...)
  | "neuralgia" // cranial neuralgia (occipital, trigeminal)
  | "emergency"; // must be excluded urgently

/** A possible cause the logged pattern fits, with the concrete next step. */
export interface CauseCandidate {
  id: string;
  name: string;
  /** ICHD-3 code where one cleanly applies (else omitted). */
  code?: string;
  category: CauseCategory;
  urgency: Urgency;
  /** 0..1 rough fit from the diary + profile (for ordering only). */
  score: number;
  /** Features in the diary/profile that point toward this. */
  matched: string[];
  /** Features that argue against (shown for honesty). */
  against: string[];
  /** The specific test that confirms or excludes it. */
  confirmingTest: string;
  /** Who to see for that test. */
  specialist: string;
  /** One sentence the patient can say to the doctor. */
  whatToSay: string;
  /** Caveat / why the diary can't conclude it. */
  note?: string;
}

/** SNNOOP10-style secondary-headache red flag. */
export interface RedFlag {
  id: string;
  label: string;
  detail: string; // what in the data/profile triggered it
  action: string; // what to do about it
  urgency: Urgency;
}

export interface MohStatus {
  atRisk: boolean;
  acuteMedDaysPerMonth: number;
  threshold: number;
  medClass: string;
  message: string;
}

export interface TreatmentMismatch {
  present: boolean;
  message: string;
}

export interface WorkupGap {
  test: string;
  reason: string;
  done: boolean;
}

export interface CauseReport {
  daysLogged: number;
  /** urgency==='emergency' — shown first, loud. */
  emergencies: RedFlag[];
  /** other red flags worth a prompt doctor visit. */
  redFlags: RedFlag[];
  /** ranked possible causes (primary + secondary + neuralgia). */
  candidates: CauseCandidate[];
  moh: MohStatus;
  mismatch: TreatmentMismatch;
  workupGaps: WorkupGap[];
  /** the two-layer message when a daily baseline + episodic attacks coexist. */
  twoLayer: string | null;
  disclaimer: string;
}
