// Entry[] -> DiaryAggregate adapter (BLUEPRINT §7).
//
// Bridges the stored Dexie `Entry` history (snake_case, daily-UX shaped) into the
// engine's `DiaryAggregate` (camelCase, ICHD-3 shaped), validates at the boundary
// with Zod, then runs classify(). The engine reads ONLY structured fields here —
// never the free-text `note` (CONTRACT: free text is UX only, must never change a
// verdict, and protects multilingual Hinglish/Devanagari notes from mis-parsing).
//
// NOTE on imports: engine.ts also imports toAggregate from this file (for
// progressiveInsight). The cycle is safe because every reference is inside a
// function body, never at module-eval time.

import type { Entry } from "@/lib/db";
import { DiaryAggregate } from "./model";
import { classify } from "./engine";
import type { DxResult } from "./model";

/** Build the engine input from the full entry history + the modal/typical attack. */
export function toAggregate(entries: Entry[]): DxResult[] | null {
  const headacheDays = entries.filter((e) => !e.no_headache);
  // pick the most recent headache day as the modal attack carrier (or merge as you prefer)
  const modal = headacheDays[headacheDays.length - 1];
  if (!modal) return null;

  const input = {
    attack: {
      typicalDurationHours: modal.duration_hours ?? 0,
      minDurationHours: modal.min_duration_hours ?? modal.duration_hours ?? 0,
      maxDurationHours: modal.max_duration_hours ?? modal.duration_hours ?? 0,
      laterality: modal.laterality ?? "bilateral",
      sideLocked: modal.side_locked,
      quality: modal.quality ?? "other",
      intensity0to10: modal.intensity ?? modal.worst,
      aggravatedByRoutineActivity: modal.aggravated_by_activity,
      nausea: modal.nausea,
      vomiting: modal.vomiting,
      photophobia: modal.photophobia,
      phonophobia: modal.phonophobia,
      painRegions: modal.pain_regions,
      auraPresent: modal.aura,
      auraTypes: modal.aura_types,
      auraFullyReversible: modal.aura_fully_reversible,
      auraSpreadsOver5min: modal.aura_spreads_over_5min,
      auraSymptomsInSuccession: modal.aura_symptoms_in_succession,
      auraEachSymptom5to60min: modal.aura_each_5to60min,
      auraAtLeastOneUnilateral: modal.aura_at_least_one_unilateral,
      auraAtLeastOnePositive: modal.aura_at_least_one_positive,
      auraFollowedByHeadacheWithin60min: modal.aura_followed_by_headache_60min,
      conjunctivalInjectionOrLacrimation: modal.conjunctival_injection_or_lacrimation,
      nasalCongestionOrRhinorrhoea: modal.nasal_congestion_or_rhinorrhoea,
      eyelidOedema: modal.eyelid_oedema,
      foreheadFacialSweating: modal.forehead_facial_sweating,
      miosisOrPtosis: modal.miosis_or_ptosis,
      restlessnessOrAgitation: modal.restlessness_or_agitation,
      neckRangeOfMotionReduced: modal.neck_range_of_motion_reduced,
      headacheWorsenedByNeckManoeuvres: modal.headache_worsened_by_neck_manoeuvres,
    },
    distinctAttackCount: modal.distinct_attack_count,
    headacheDaysPerMonth: modal.headache_days_per_month,
    migrainousDaysPerMonth: modal.migrainous_days_per_month,
    observationMonths: modal.observation_months,
    attackFrequencyPerDay: modal.attack_frequency_per_day,
    boutPattern: modal.bout_pattern,
    onsetPattern: modal.onset_pattern,
    acuteMedDaysPerMonth: modal.acute_med_days_per_month,
    medClass: modal.med_class,
    preExistingPrimaryHeadache: modal.pre_existing_primary_headache,
    indomethacinResponse: modal.indomethacin_response,
    cervicalImagingOrClinicalEvidence: modal.cervical_imaging_or_clinical_evidence,
    nerveBlockAbolishesHeadache: modal.nerve_block_abolishes_headache,
    betterAccountedByOtherDx: modal.better_accounted_by_other_dx,
  };

  DiaryAggregate.parse(input); // validate boundary (throws on malformed input)
  return classify(input); // DxResult[]
}
