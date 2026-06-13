"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Entry } from "@/lib/db";

/**
 * The slice of an `Entry` the user actively edits on the Today screen each day.
 * Everything else (id / timestamps / derived aggregates / clinical-test
 * defaults) is filled in by `EntryForm` at save time.
 */
export type EntryDraft = Pick<
  Entry,
  | "no_headache"
  | "worst"
  | "duration_hours"
  | "laterality"
  | "side_locked"
  | "quality"
  | "intensity"
  | "aggravated_by_activity"
  | "nausea"
  | "vomiting"
  | "photophobia"
  | "phonophobia"
  | "aura"
  | "aura_types"
  | "aura_fully_reversible"
  | "aura_spreads_over_5min"
  | "aura_symptoms_in_succession"
  | "aura_each_5to60min"
  | "aura_at_least_one_unilateral"
  | "aura_at_least_one_positive"
  | "aura_followed_by_headache_60min"
  | "conjunctival_injection_or_lacrimation"
  | "nasal_congestion_or_rhinorrhoea"
  | "eyelid_oedema"
  | "forehead_facial_sweating"
  | "miosis_or_ptosis"
  | "restlessness_or_agitation"
  | "neck_range_of_motion_reduced"
  | "headache_worsened_by_neck_manoeuvres"
  | "onset_pattern"
  | "meds"
  | "meds_other"
  | "note"
> & {
  /** UX-only context chips (not engine inputs). */
  when: string[];
  worse: string[];
  better: string[];
};

export function freshDraft(): EntryDraft {
  return {
    no_headache: false,
    worst: 5,
    duration_hours: undefined,
    laterality: undefined,
    side_locked: false,
    quality: undefined,
    intensity: 5,
    aggravated_by_activity: false,
    nausea: "none",
    vomiting: false,
    photophobia: false,
    phonophobia: false,
    aura: false,
    aura_types: [],
    aura_fully_reversible: false,
    aura_spreads_over_5min: false,
    aura_symptoms_in_succession: false,
    aura_each_5to60min: false,
    aura_at_least_one_unilateral: false,
    aura_at_least_one_positive: false,
    aura_followed_by_headache_60min: false,
    conjunctival_injection_or_lacrimation: false,
    nasal_congestion_or_rhinorrhoea: false,
    eyelid_oedema: false,
    forehead_facial_sweating: false,
    miosis_or_ptosis: false,
    restlessness_or_agitation: false,
    neck_range_of_motion_reduced: false,
    headache_worsened_by_neck_manoeuvres: false,
    onset_pattern: "unknown",
    meds: [],
    meds_other: undefined,
    note: undefined,
    when: [],
    worse: [],
    better: [],
  };
}

/**
 * Persisted, slowly-changing fields that carry across days — the user is asked
 * for these once (in You / settings), and `EntryForm` snapshots them onto each
 * saved entry so the doctor report is reproducible.
 */
export interface DiarySettings {
  pre_existing_primary_headache: boolean;
  med_class: Entry["med_class"];
  indomethacin_response: Entry["indomethacin_response"];
  cervical_imaging_or_clinical_evidence: boolean;
  nerve_block_abolishes_headache: Entry["nerve_block_abolishes_headache"];
  /** clinician-set exclusion; defaults false. */
  better_accounted_by_other_dx: boolean;
}

export function defaultSettings(): DiarySettings {
  return {
    pre_existing_primary_headache: false,
    med_class: "none",
    indomethacin_response: "not_tested",
    cervical_imaging_or_clinical_evidence: false,
    nerve_block_abolishes_headache: "not_tested",
    better_accounted_by_other_dx: false,
  };
}

interface EntryStore {
  draft: EntryDraft;
  settings: DiarySettings;
  patchDraft: (patch: Partial<EntryDraft>) => void;
  resetDraft: () => void;
  patchSettings: (patch: Partial<DiarySettings>) => void;
}

export const useEntryStore = create<EntryStore>()(
  persist(
    (set) => ({
      draft: freshDraft(),
      settings: defaultSettings(),
      patchDraft: (patch) =>
        set((s) => ({ draft: { ...s.draft, ...patch } })),
      resetDraft: () => set({ draft: freshDraft() }),
      patchSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "headache-diary-store",
      // Persist only the slow-changing settings; the daily draft starts fresh.
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);
