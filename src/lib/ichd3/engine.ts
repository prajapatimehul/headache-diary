// ICHD-3 rule engine — pure, deterministic, no I/O.
//
// Every diagnosis returns per-criterion pass/fail with the human-readable text +
// the actual measured value in the reason, plus a `missing` list. PROBABLE is
// emitted only via the official 1.5 / 2.4 / 3.5 probable pattern (attack-count
// shortfall or single missing criterion). NEEDS_TEST hard-gates 3.2 (crit E),
// 3.4 (crit D) on indomethacin, and 11.2.1 (crit B + C.4) on imaging/nerve block
// — these can never be auto-concluded MET from diary data. CM+MOH are
// intentionally returned as two independent MET results (ICHD says code both).
//
// Result types (Verdict, CriterionResult, DxResult) are defined in model.ts —
// the authoritative location per CONTRACT.md §19-20 — and re-exported here so
// existing `import { DxResult } from "./engine"` callers keep working.

import { DiaryAggregate } from "./model";
import type { Verdict, CriterionResult, DxResult } from "./model";
import type { Entry } from "@/lib/db";

export type { Verdict, CriterionResult, DxResult } from "./model";

const band = (i: number) => (i <= 3 ? "mild" : i <= 6 ? "moderate" : "severe");
const intensityModerateOrSevere = (i: number) => i >= 4;
const c = (id: string, text: string, passed: boolean, reason?: string): CriterionResult => ({
  id,
  text,
  passed,
  reason,
});

/* ================================================================== */
/* 1. MIGRAINE                                                         */
/* ================================================================== */

/** 1.1 Migraine without aura — ICHD-3 A-E. */
export function migraineWithoutAura(d: DiaryAggregate): DxResult {
  const a = d.attack;
  const charB = [
    a.laterality === "unilateral",
    a.quality === "pulsating",
    intensityModerateOrSevere(a.intensity0to10),
    a.aggravatedByRoutineActivity,
  ];
  const cPassed = charB.filter(Boolean).length >= 2; // crit C: >=2 of 4
  const durationOk = a.minDurationHours >= 4 && a.maxDurationHours <= 72;
  const dPassed = a.nausea !== "none" || a.vomiting || (a.photophobia && a.phonophobia);
  const crits: CriterionResult[] = [
    c(
      "B",
      "Attacks last 4-72h (untreated)",
      durationOk,
      durationOk ? undefined : `duration band ${a.minDurationHours}-${a.maxDurationHours}h`,
    ),
    c(
      "C",
      `>=2 of: unilateral, pulsating, moderate/severe, aggravated by activity (got ${charB.filter(Boolean).length})`,
      cPassed,
    ),
    c("D", ">=1 of: nausea/vomiting, OR photophobia+phonophobia", dPassed),
    c("E", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const coreMet = crits.every((x) => x.passed);
  const enoughAttacks = d.distinctAttackCount >= 5; // crit A
  let verdict: Verdict;
  if (coreMet && enoughAttacks) verdict = "MET";
  else if (coreMet && d.distinctAttackCount > 0)
    verdict = "PROBABLE"; // 1.5.1 Probable MwoA: <5 attacks
  else verdict = "NOT_MET";
  return {
    code: verdict === "PROBABLE" ? "1.5.1" : "1.1",
    name: verdict === "PROBABLE" ? "Probable migraine without aura" : "Migraine without aura",
    verdict,
    criteria: [c("A", `>=5 attacks (got ${d.distinctAttackCount})`, enoughAttacks), ...crits],
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/** 1.2 Migraine with aura — A-D. */
export function migraineWithAura(d: DiaryAggregate): DxResult {
  const a = d.attack;
  const cChars = [
    a.auraSpreadsOver5min,
    a.auraSymptomsInSuccession,
    a.auraEachSymptom5to60min,
    a.auraAtLeastOneUnilateral,
    a.auraAtLeastOnePositive,
    a.auraFollowedByHeadacheWithin60min,
  ];
  const cN = cChars.filter(Boolean).length;
  const crits = [
    c(
      "B",
      ">=1 fully reversible aura symptom (visual/sensory/speech/motor/brainstem/retinal)",
      a.auraPresent && a.auraFullyReversible && a.auraTypes.length > 0,
    ),
    c("C", `>=3 of 6 aura characteristics (got ${cN})`, cN >= 3),
    c("D", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const coreMet = crits.every((x) => x.passed);
  const enough = d.distinctAttackCount >= 2; // crit A: >=2 attacks
  const verdict: Verdict =
    coreMet && enough ? "MET" : coreMet && a.auraPresent ? "PROBABLE" : "NOT_MET";
  return {
    code: verdict === "PROBABLE" ? "1.5.2" : "1.2",
    name: verdict === "PROBABLE" ? "Probable migraine with aura" : "Migraine with aura",
    verdict,
    criteria: [c("A", `>=2 attacks (got ${d.distinctAttackCount})`, enough), ...crits],
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/** 1.3 Chronic migraine — A-D. Excludes 2.3 CTTH when MET (see classify()). */
export function chronicMigraine(d: DiaryAggregate): DxResult {
  const crits = [
    c(
      "A",
      `Headache >=15 days/month for >3 months (got ${d.headacheDaysPerMonth}/mo, ${d.observationMonths}mo)`,
      d.headacheDaysPerMonth >= 15 && d.observationMonths > 3,
    ),
    c("B", ">=5 prior attacks meeting 1.1 B-D or 1.2 B-C", d.distinctAttackCount >= 5),
    c(
      "C",
      `On >=8 days/month has migraine features (got ${d.migrainousDaysPerMonth}/mo)`,
      d.migrainousDaysPerMonth >= 8,
    ),
    c("D", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const verdict: Verdict = crits.every((x) => x.passed) ? "MET" : "NOT_MET";
  return {
    code: "1.3",
    name: "Chronic migraine",
    verdict,
    criteria: crits,
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/* ================================================================== */
/* 2. TENSION-TYPE                                                     */
/* ================================================================== */

/** 2.1/2.2/2.3 Tension-type — shared B-E, frequency band picks the subtype. */
export function tensionType(d: DiaryAggregate): DxResult {
  const a = d.attack;
  const durDays = a.maxDurationHours / 24;
  const cChars = [
    a.laterality === "bilateral",
    a.quality === "pressing_tightening",
    band(a.intensity0to10) === "mild" || band(a.intensity0to10) === "moderate",
    !a.aggravatedByRoutineActivity,
  ];
  const cN = cChars.filter(Boolean).length;
  // chronic allows mild nausea; episodic forbids nausea entirely
  const isChronicPattern = d.headacheDaysPerMonth >= 15;
  const dEpisodic = a.nausea === "none" && !a.vomiting && !(a.photophobia && a.phonophobia);
  const dChronic =
    !((a.photophobia && a.phonophobia) || ["moderate", "severe"].includes(a.nausea)) && !a.vomiting;
  const durOkEpisodic = a.minDurationHours >= 0.5 && durDays <= 7; // 30 min - 7 days
  const crits = [
    c(
      "B",
      isChronicPattern ? "Lasts hours-days or unremitting" : "Lasts 30 min - 7 days",
      isChronicPattern ? true : durOkEpisodic,
    ),
    c("C", `>=2 of: bilateral, pressing, mild/moderate, not aggravated (got ${cN})`, cN >= 2),
    c(
      "D",
      isChronicPattern
        ? "No moderate/severe nausea, <=1 of photo/phono/mild-nausea"
        : "No nausea/vomiting, <=1 of photo/phono",
      isChronicPattern ? dChronic : dEpisodic,
    ),
    c("E", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const core = crits.every((x) => x.passed);
  let code = "2.x";
  let name = "Tension-type headache";
  let enough = false;
  if (isChronicPattern) {
    code = "2.3";
    name = "Chronic tension-type headache";
    enough = d.observationMonths > 3;
  } else if (d.headacheDaysPerMonth >= 1 && d.headacheDaysPerMonth < 15) {
    code = "2.2";
    name = "Frequent episodic TTH";
    enough = d.distinctAttackCount >= 10 && d.observationMonths > 3;
  } else {
    code = "2.1";
    name = "Infrequent episodic TTH";
    enough = d.distinctAttackCount >= 10;
  }
  const verdict: Verdict = core && enough ? "MET" : core ? "PROBABLE" : "NOT_MET";
  return {
    code: verdict === "PROBABLE" ? "2.4" : code,
    name,
    verdict,
    criteria: crits,
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/* ================================================================== */
/* 3. TRIGEMINAL AUTONOMIC CEPHALALGIAS                                */
/* ================================================================== */

/** 3.1 Cluster headache — A-E. */
export function clusterHeadache(d: DiaryAggregate): DxResult {
  const a = d.attack;
  const tacRegion = a.painRegions.some((r) => ["orbital", "supraorbital", "temporal"].includes(r));
  const durMin = a.typicalDurationHours * 60;
  const autonomic =
    a.conjunctivalInjectionOrLacrimation ||
    a.nasalCongestionOrRhinorrhoea ||
    a.eyelidOedema ||
    a.foreheadFacialSweating ||
    a.miosisOrPtosis;
  const crits = [
    c(
      "B",
      `Severe unilateral orbital/supraorbital/temporal pain 15-180 min (got ~${durMin}min)`,
      a.laterality === "unilateral" && tacRegion && a.intensity0to10 >= 7 && durMin >= 15 && durMin <= 180,
    ),
    c("C", ">=1 ipsilateral autonomic sign OR restlessness/agitation", autonomic || a.restlessnessOrAgitation),
    c(
      "D",
      `Frequency 1-every-other-day to 8/day (got ${d.attackFrequencyPerDay}/day)`,
      d.attackFrequencyPerDay >= 0.5 && d.attackFrequencyPerDay <= 8,
    ),
    c("E", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const core = crits.every((x) => x.passed);
  const enough = d.distinctAttackCount >= 5;
  const verdict: Verdict = core && enough ? "MET" : core ? "PROBABLE" : "NOT_MET";
  return {
    code: verdict === "PROBABLE" ? "3.5.1" : "3.1",
    name: verdict === "PROBABLE" ? "Probable cluster headache" : "Cluster headache",
    verdict,
    criteria: [c("A", `>=5 attacks (got ${d.distinctAttackCount})`, enough), ...crits],
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/** 3.2 Paroxysmal hemicrania — A-F. Crit E = indomethacin -> NEEDS_TEST gate. */
export function paroxysmalHemicrania(d: DiaryAggregate): DxResult {
  const a = d.attack;
  const durMin = a.typicalDurationHours * 60;
  const tacRegion = a.painRegions.some((r) => ["orbital", "supraorbital", "temporal"].includes(r));
  const autonomic =
    a.conjunctivalInjectionOrLacrimation ||
    a.nasalCongestionOrRhinorrhoea ||
    a.eyelidOedema ||
    a.foreheadFacialSweating ||
    a.miosisOrPtosis;
  const clinical = [
    c("A", `>=20 attacks (got ${d.distinctAttackCount})`, d.distinctAttackCount >= 20),
    c(
      "B",
      `Severe unilateral orbital/supraorbital/temporal pain 2-30 min (got ~${durMin}min)`,
      a.laterality === "unilateral" && tacRegion && a.intensity0to10 >= 7 && durMin >= 2 && durMin <= 30,
    ),
    c("C", ">=1 ipsilateral autonomic sign OR restlessness/agitation", autonomic || a.restlessnessOrAgitation),
    c("D", `Frequency >5/day (got ${d.attackFrequencyPerDay}/day)`, d.attackFrequencyPerDay > 5),
    c("F", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const clinicalMet = clinical.every((x) => x.passed);
  const indoMet = d.indomethacinResponse === "absolute";
  const critE = c(
    "E",
    "Prevented absolutely by therapeutic-dose indomethacin",
    indoMet,
    d.indomethacinResponse === "not_tested"
      ? "indomethacin trial not performed"
      : `response=${d.indomethacinResponse}`,
  );
  let verdict: Verdict;
  let needsTest: string | undefined;
  if (clinicalMet && indoMet) verdict = "MET";
  else if (clinicalMet && d.indomethacinResponse === "not_tested") {
    verdict = "NEEDS_TEST";
    needsTest =
      "Indomethacin trial required (>=150mg/day, up to 225mg). Cannot conclude PH from diary alone.";
  } else verdict = "NOT_MET";
  return {
    code: "3.2",
    name: "Paroxysmal hemicrania",
    verdict,
    ...(needsTest ? { needsTest } : {}),
    criteria: [...clinical.slice(0, 4), critE, clinical[4]],
    missing: [...clinical.filter((x) => !x.passed).map((x) => x.id), ...(indoMet ? [] : ["E"])],
  };
}

/** 3.4 Hemicrania continua — A-E. Crit D = indomethacin -> NEEDS_TEST gate. */
export function hemicraniaContinua(d: DiaryAggregate): DxResult {
  const a = d.attack;
  const autonomic =
    a.conjunctivalInjectionOrLacrimation ||
    a.nasalCongestionOrRhinorrhoea ||
    a.eyelidOedema ||
    a.foreheadFacialSweating ||
    a.miosisOrPtosis;
  const clinical = [
    c("A", "Unilateral headache fulfilling B-D", a.laterality === "unilateral"),
    c(
      "B",
      `Present >3 months with moderate-or-greater exacerbations (got ${d.observationMonths}mo)`,
      d.observationMonths > 3 && d.headacheDaysPerMonth >= 28,
    ),
    c(
      "C",
      ">=1 ipsilateral autonomic sign OR restlessness/agitation/aggravation by movement",
      autonomic || a.restlessnessOrAgitation,
    ),
    c("E", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const clinicalMet = clinical.every((x) => x.passed);
  const indoMet = d.indomethacinResponse === "absolute";
  const critD = c(
    "D",
    "Responds absolutely to therapeutic-dose indomethacin",
    indoMet,
    d.indomethacinResponse === "not_tested"
      ? "indomethacin trial not performed"
      : `response=${d.indomethacinResponse}`,
  );
  let verdict: Verdict;
  let needsTest: string | undefined;
  if (clinicalMet && indoMet) verdict = "MET";
  else if (clinicalMet && d.indomethacinResponse === "not_tested") {
    verdict = "NEEDS_TEST";
    needsTest = "Indomethacin trial required. Cannot conclude HC from diary alone.";
  } else verdict = "NOT_MET";
  return {
    code: "3.4",
    name: "Hemicrania continua",
    verdict,
    ...(needsTest ? { needsTest } : {}),
    criteria: [...clinical.slice(0, 3), critD, clinical[3]],
    missing: [...clinical.filter((x) => !x.passed).map((x) => x.id), ...(indoMet ? [] : ["D"])],
  };
}

/* ================================================================== */
/* 8. MEDICATION-OVERUSE                                               */
/* ================================================================== */

/** 8.2 Medication-overuse headache — A-C. Day threshold depends on med class. */
export function medicationOveruse(d: DiaryAggregate): DxResult {
  const threshold = d.medClass === "simple_nonopioid" ? 15 : 10; // ergot/triptan/opioid/combo/multiple = 10; simple analgesic = 15
  const overuse = d.medClass !== "none" && d.acuteMedDaysPerMonth >= threshold && d.observationMonths > 3;
  const crits = [
    c(
      "A",
      `Headache >=15 days/month with pre-existing headache disorder (got ${d.headacheDaysPerMonth}/mo, pre-existing=${d.preExistingPrimaryHeadache})`,
      d.headacheDaysPerMonth >= 15 && d.preExistingPrimaryHeadache,
    ),
    c(
      "B",
      `Regular overuse >3mo: ${d.medClass} on >=${threshold} days/mo (got ${d.acuteMedDaysPerMonth}/mo)`,
      overuse,
    ),
    c("C", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const verdict: Verdict = crits.every((x) => x.passed) ? "MET" : "NOT_MET";
  const codeMap: Record<string, string> = {
    ergotamine: "8.2.1",
    triptan: "8.2.2",
    simple_nonopioid: "8.2.3",
    opioid: "8.2.4",
    combination_analgesic: "8.2.5",
    multiple_not_individually: "8.2.6",
    none: "8.2",
  };
  return {
    code: codeMap[d.medClass] ?? "8.2",
    name: "Medication-overuse headache",
    verdict,
    criteria: crits,
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/* ================================================================== */
/* 4.10 / 11.2.1                                                       */
/* ================================================================== */

/** 4.10 New daily persistent headache — A-D. */
export function ndph(d: DiaryAggregate): DxResult {
  const crits = [
    c(
      "B",
      "Distinct, clearly-remembered onset; continuous & unremitting within 24h",
      d.onsetPattern === "daily_unremitting_from_onset_within_24h",
    ),
    c("C", `Present >3 months (got ${d.observationMonths}mo)`, d.observationMonths > 3),
    c("D", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  const verdict: Verdict = crits.every((x) => x.passed) ? "MET" : "NOT_MET";
  return {
    code: "4.10",
    name: "New daily persistent headache",
    verdict,
    criteria: crits,
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/** 11.2.1 Cervicogenic headache — A-D. Needs imaging/clinical + (optionally) nerve block. */
export function cervicogenic(d: DiaryAggregate): DxResult {
  const a = d.attack;
  // crit C: >=2 of 4 causation items; items 1-2 are clinical-history, item 3 diary-derivable, item 4 = nerve block (test)
  const diaryNeckSignal =
    a.neckRangeOfMotionReduced &&
    a.headacheWorsenedByNeckManoeuvres &&
    (a.sideLocked || a.painRegions.includes("occipital"));
  const causationItems = [
    false, // C1 temporal relation to cervical disorder onset — clinician input, default unknown
    false, // C2 improved/resolved with cervical disorder — clinician input, default unknown
    diaryNeckSignal, // C3 diary-derivable
    d.nerveBlockAbolishesHeadache === "yes", // C4 nerve block (test)
  ];
  const causationCount = causationItems.filter(Boolean).length;
  const crits = [
    c("A", "Any headache fulfilling criterion C", causationCount >= 2),
    c(
      "B",
      "Clinical/imaging evidence of a cervical-spine/soft-tissue disorder known to cause headache",
      d.cervicalImagingOrClinicalEvidence,
      d.cervicalImagingOrClinicalEvidence ? undefined : "imaging/clinical evidence not recorded",
    ),
    c("C", `>=2 of 4 causation items (got ${causationCount}; side-locked=${a.sideLocked})`, causationCount >= 2),
    c("D", "Not better accounted for by another ICHD-3 dx", !d.betterAccountedByOtherDx),
  ];
  let verdict: Verdict;
  let needsTest: string | undefined;
  if (crits.every((x) => x.passed)) verdict = "MET";
  else if (
    diaryNeckSignal &&
    (!d.cervicalImagingOrClinicalEvidence ||
      d.nerveBlockAbolishesHeadache === "not_tested")
  ) {
    verdict = "NEEDS_TEST";
    needsTest =
      "Requires clinical/imaging evidence of a cervical lesion and/or diagnostic nerve block. Cannot conclude cervicogenic headache from diary alone.";
  } else verdict = "NOT_MET";
  return {
    code: "11.2.1",
    name: "Cervicogenic headache",
    verdict,
    ...(needsTest ? { needsTest } : {}),
    criteria: crits,
    missing: crits.filter((x) => !x.passed).map((x) => x.id),
  };
}

/* ================================================================== */
/* Top-level classify() — run all, then apply ICHD-3 hierarchy        */
/* ================================================================== */

/** Run all 10 dx functions, then apply the ICHD-3 hierarchy post-pass. */
export function classify(input: unknown): DxResult[] {
  const d = DiaryAggregate.parse(input); // throws on malformed input only
  const results = [
    migraineWithoutAura(d),
    migraineWithAura(d),
    chronicMigraine(d),
    tensionType(d),
    clusterHeadache(d),
    paroxysmalHemicrania(d),
    hemicraniaContinua(d),
    medicationOveruse(d),
    ndph(d),
    cervicogenic(d),
  ];
  const byCode = (cd: string) => results.find((r) => r.code.startsWith(cd));
  // Hierarchy rule: 1.3 Chronic migraine subsumes tension-type-like days -> exclude 2.3 CTTH.
  const cm = byCode("1.3");
  const ctth = results.find((r) => r.code === "2.3");
  if (cm?.verdict === "MET" && ctth?.verdict === "MET") {
    ctth.verdict = "NOT_MET";
    ctth.missing.push("excluded by 1.3 Chronic migraine");
  }
  // Hierarchy rule: 4.10 NDPH is default over CM/CTTH when onset is daily-from-onset.
  const n = byCode("4.10");
  if (n?.verdict === "MET" && d.onsetPattern === "daily_unremitting_from_onset_within_24h") {
    if (cm) cm.missing.push("4.10 NDPH takes precedence (daily-from-onset)");
  }
  // NOTE: CM (1.3) + MOH (8.2.x) are intentionally left as TWO independent MET
  // results — ICHD says code both. Do not suppress one with the other.
  return results;
}

/* ================================================================== */
/* Progressive insight (5-day / 30-day feature) — CONTRACT §33-39     */
/* ================================================================== */

import { toAggregate } from "./aggregate";

export type InsightStage = "warmup" | "preliminary" | "strong";

export interface ProgressiveInsight {
  daysLogged: number;
  stage: InsightStage;
  /** 0..1 — how much weight to give the result given the data depth. */
  confidence: number;
  /** Best 1-3 ICHD-3 candidates so far (verdict-ranked). */
  topCandidates: DxResult[];
  /** What still needs to be logged / tested to separate the candidates. */
  needed: string[];
  /** Honest limitations the UI / report must surface. */
  caveats: string[];
}

/** Rank order for picking "top" candidates from a classify() run. */
const VERDICT_RANK: Record<Verdict, number> = {
  MET: 0,
  NEEDS_TEST: 1,
  PROBABLE: 2,
  NOT_MET: 3,
};

const DISCLAIMER = "Decision support, not a diagnosis. Confirm with a clinician.";

/** Diagnoses whose ICHD criteria require >=3 months of observation. */
const THREE_MONTH_CODES = ["1.3", "2.3", "8.2"];
/** Diagnoses that can never be auto-MET from diary data (need a clinical test). */
const NEEDS_TEST_CODES = ["3.2", "3.4", "11.2.1"];

/**
 * Progressive, honesty-first read of how confident the engine can be given the
 * number of days actually logged. The Insight page renders this; the print
 * report includes the strong-stage analysis. Reads ONLY structured fields via
 * toAggregate — never the free-text note.
 *
 * Stages (CONTRACT §33-39):
 *  - daysLogged < 5            -> "warmup"      (keep logging)
 *  - 5 <= daysLogged < 30      -> "preliminary" (top 2-3, low confidence)
 *  - daysLogged >= 30          -> "strong"      (full classify() + caveats)
 */
export function progressiveInsight(entries: Entry[]): ProgressiveInsight {
  const daysLogged = new Set(entries.map((e) => e.date)).size;

  /* ---- Warmup: not enough data to say anything useful yet ---- */
  if (daysLogged < 5) {
    return {
      daysLogged,
      stage: "warmup",
      confidence: 0,
      topCandidates: [],
      needed: [
        `Keep logging — ${5 - daysLogged} more logged day${5 - daysLogged === 1 ? "" : "s"} until a preliminary read.`,
      ],
      caveats: [
        DISCLAIMER,
        "Too few entries for any ICHD-3 pattern. This is not a result yet.",
      ],
    };
  }

  // From here we have >=5 days, so toAggregate() will produce results.
  const results = toAggregate(entries) ?? [];
  // Verdict-ranked, MET/NEEDS_TEST/PROBABLE first; stable within rank by code.
  const ranked = [...results].sort((a, b) => {
    const r = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
    return r !== 0 ? r : a.code.localeCompare(b.code);
  });
  const positives = ranked.filter((r) => r.verdict !== "NOT_MET");

  /* ---- Preliminary: 5..29 days — top 2-3 candidates, low confidence ---- */
  if (daysLogged < 30) {
    const topCandidates = (positives.length > 0 ? positives : ranked).slice(0, 3);
    // Linear ramp 0.2 -> ~0.55 across the 5..29 window.
    const confidence = Math.min(0.55, 0.2 + ((daysLogged - 5) / 25) * 0.35);
    const needed: string[] = [
      `Log to 30 days for a strong read (${Math.max(0, 30 - daysLogged)} to go).`,
    ];
    // What separates the leading candidates?
    for (const cand of topCandidates) {
      if (THREE_MONTH_CODES.includes(cand.code)) {
        needed.push(`${cand.name} (${cand.code}) needs >3 months of consistent logging to confirm.`);
      }
      if (NEEDS_TEST_CODES.includes(cand.code) || cand.verdict === "NEEDS_TEST") {
        needed.push(
          cand.needsTest ?? `${cand.name} (${cand.code}) needs a clinical test before it can be confirmed.`,
        );
      }
      if (cand.verdict === "PROBABLE" && cand.missing.length > 0) {
        needed.push(
          `${cand.name} is only "probable" — unmet so far: ${cand.missing.join(", ")}.`,
        );
      }
    }
    return {
      daysLogged,
      stage: "preliminary",
      confidence,
      topCandidates,
      needed: [...new Set(needed)],
      caveats: [
        DISCLAIMER,
        "Preliminary read from a partial diary. Patterns can change as you log more.",
      ],
    };
  }

  /* ---- Strong: >=30 days — full classify(), but never overstate ---- */
  const topCandidates = (positives.length > 0 ? positives : ranked).slice(0, 3);
  // 0.6 at 30 days, asymptotically approaching ~0.9; clinical-test/3-month gaps trim it below.
  let confidence = Math.min(0.9, 0.6 + Math.min(0.3, ((daysLogged - 30) / 60) * 0.3));

  const needed: string[] = [];
  const caveats: string[] = [DISCLAIMER];

  for (const cand of topCandidates) {
    if (THREE_MONTH_CODES.includes(cand.code)) {
      caveats.push(
        `${cand.name} (${cand.code}) requires headache pattern stable over >3 months — verify the observation window.`,
      );
    }
    if (cand.verdict === "NEEDS_TEST" || NEEDS_TEST_CODES.includes(cand.code)) {
      const note =
        cand.needsTest ?? `${cand.name} (${cand.code}) cannot be confirmed from the diary — a clinical test is required.`;
      caveats.push(note);
      needed.push(note);
      confidence = Math.min(confidence, 0.7); // honesty cap: a gated dx is in the lead
    }
    if (cand.verdict === "PROBABLE" && cand.missing.length > 0) {
      needed.push(`${cand.name} is only "probable" — unmet: ${cand.missing.join(", ")}.`);
    }
  }

  // If "not better accounted for by another dx" (the universal final criterion)
  // is unset, the engine assumed no competing diagnosis — surface it.
  caveats.push(
    "The engine assumes no competing diagnosis (the clinician-set 'not better accounted for by another ICHD-3 dx' flag). A doctor must confirm.",
  );

  return {
    daysLogged,
    stage: "strong",
    confidence,
    topCandidates,
    needed: [...new Set(needed)],
    caveats: [...new Set(caveats)],
  };
}
