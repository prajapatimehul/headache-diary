import type { Entry, PainMark } from "../src/lib/db";
import {
  blankProfile,
  blankWorkup,
  type CauseProfile,
  type PriorWorkup,
} from "../src/lib/cause-finder/profile";

export const CASE_ANCHOR_START = "2026-05-16";
export const CASE_ANCHOR_END = "2026-06-14";

type EntryPatch = Partial<Omit<Entry, "id" | "user_id" | "date" | "created_at" | "updated_at">>;

type ProfilePatch = Partial<Omit<CauseProfile, "workup">> & {
  workup?: Partial<PriorWorkup>;
};

export interface PublicCaseSource {
  pmcid: string;
  title: string;
  url: string;
  caseLabel?: string;
  sourceDiagnosis: string;
}

export interface PublicCaseFixture {
  id: string;
  source: PublicCaseSource;
  notes: string;
  entries: Entry[];
  profile: CauseProfile;
  expectedDx: string[];
  observationLimitedDx?: string[];
  expectedCauseIds?: string[];
  expectedMohAtRisk?: boolean;
}

const DATES = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(`${CASE_ANCHOR_START}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});

const spreadDays = (count: number): Set<number> => {
  if (count >= 30) return new Set(DATES.map((_, i) => i));
  if (count <= 0) return new Set();
  return new Set(
    Array.from({ length: count }, (_, i) =>
      Math.min(29, Math.round((i * 29) / Math.max(1, count - 1))),
    ),
  );
};

const firstDays = (count: number): Set<number> =>
  new Set(DATES.slice(0, count).map((_, i) => i));

const source = (
  pmcid: string,
  title: string,
  sourceDiagnosis: string,
  caseLabel?: string,
): PublicCaseSource => ({
  pmcid,
  title,
  url: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`,
  ...(caseLabel ? { caseLabel } : {}),
  sourceDiagnosis,
});

function painMark(
  caseId: string,
  date: string,
  regionId: string,
  intensity: number,
): PainMark {
  const labels: Record<string, string> = {
    orbital: "Orbit / eye",
    supraorbital: "Brow",
    temporal: "Temple",
    frontal: "Forehead",
    occipital: "Back of head",
    whole_head: "Whole head",
  };
  return {
    id: `${caseId}-${date}-${regionId}`,
    regionId,
    regionLabel: labels[regionId] ?? regionId,
    intensity,
    color: "#d7263d",
    local: [0, 0, 0],
    world: [0, 0, 0],
    ts: Date.parse(`${date}T12:00:00.000Z`),
  };
}

const baseHeadache: EntryPatch = {
  no_headache: false,
  worst: 7,
  duration_hours: 12,
  min_duration_hours: 12,
  max_duration_hours: 12,
  laterality: "unilateral",
  side_locked: false,
  quality: "pulsating",
  intensity: 7,
  aggravated_by_activity: true,
  nausea: "moderate",
  vomiting: false,
  photophobia: true,
  phonophobia: true,
  pain_regions: ["temporal"],
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
  attack_frequency_per_day: 1,
  bout_pattern: "episodic",
  onset_pattern: "gradual",
  med_class: "none",
  pre_existing_primary_headache: false,
  meds: [],
  indomethacin_response: "not_tested",
  cervical_imaging_or_clinical_evidence: false,
  nerve_block_abolishes_headache: "not_tested",
  better_accounted_by_other_dx: false,
};

function buildProfile(patch: ProfilePatch = {}): CauseProfile {
  const base = blankProfile();
  return {
    ...base,
    ...patch,
    workup: { ...blankWorkup(), ...(patch.workup ?? {}) },
    treatmentsTried: patch.treatmentsTried ?? base.treatmentsTried,
  };
}

function buildEntries(
  caseId: string,
  headacheDays: Set<number>,
  patch: EntryPatch,
  medDays: Set<number> = new Set(),
): Entry[] {
  return DATES.map((date, i) => {
    const hasHeadache = headacheDays.has(i);
    const headache = { ...baseHeadache, ...patch };
    const painRegions = headache.pain_regions ?? ["temporal"];
    const intensity = headache.intensity ?? headache.worst ?? 0;
    const hasMeds = medDays.has(i);
    const entry: Entry = {
      id: `${caseId}-${date}`,
      user_id: null,
      date,
      no_headache: !hasHeadache,
      worst: hasHeadache ? headache.worst ?? intensity : 0,
      regions: hasHeadache
        ? painRegions.map((region) =>
            painMark(caseId, date, region, Math.max(1, intensity)),
          )
        : [],
      duration_hours: hasHeadache ? headache.duration_hours : undefined,
      min_duration_hours: hasHeadache ? headache.min_duration_hours : undefined,
      max_duration_hours: hasHeadache ? headache.max_duration_hours : undefined,
      laterality: hasHeadache ? headache.laterality : undefined,
      side_locked: hasHeadache ? headache.side_locked ?? false : false,
      quality: hasHeadache ? headache.quality : undefined,
      intensity: hasHeadache ? intensity : 0,
      aggravated_by_activity: hasHeadache
        ? headache.aggravated_by_activity ?? false
        : false,
      nausea: hasHeadache ? headache.nausea ?? "none" : "none",
      vomiting: hasHeadache ? headache.vomiting ?? false : false,
      photophobia: hasHeadache ? headache.photophobia ?? false : false,
      phonophobia: hasHeadache ? headache.phonophobia ?? false : false,
      pain_regions: hasHeadache ? painRegions : [],
      aura: hasHeadache ? headache.aura ?? false : false,
      aura_types: hasHeadache ? headache.aura_types ?? [] : [],
      aura_fully_reversible: hasHeadache
        ? headache.aura_fully_reversible ?? false
        : false,
      aura_spreads_over_5min: hasHeadache
        ? headache.aura_spreads_over_5min ?? false
        : false,
      aura_symptoms_in_succession: hasHeadache
        ? headache.aura_symptoms_in_succession ?? false
        : false,
      aura_each_5to60min: hasHeadache
        ? headache.aura_each_5to60min ?? false
        : false,
      aura_at_least_one_unilateral: hasHeadache
        ? headache.aura_at_least_one_unilateral ?? false
        : false,
      aura_at_least_one_positive: hasHeadache
        ? headache.aura_at_least_one_positive ?? false
        : false,
      aura_followed_by_headache_60min: hasHeadache
        ? headache.aura_followed_by_headache_60min ?? false
        : false,
      conjunctival_injection_or_lacrimation: hasHeadache
        ? headache.conjunctival_injection_or_lacrimation ?? false
        : false,
      nasal_congestion_or_rhinorrhoea: hasHeadache
        ? headache.nasal_congestion_or_rhinorrhoea ?? false
        : false,
      eyelid_oedema: hasHeadache ? headache.eyelid_oedema ?? false : false,
      forehead_facial_sweating: hasHeadache
        ? headache.forehead_facial_sweating ?? false
        : false,
      miosis_or_ptosis: hasHeadache ? headache.miosis_or_ptosis ?? false : false,
      restlessness_or_agitation: hasHeadache
        ? headache.restlessness_or_agitation ?? false
        : false,
      neck_range_of_motion_reduced: hasHeadache
        ? headache.neck_range_of_motion_reduced ?? false
        : false,
      headache_worsened_by_neck_manoeuvres: hasHeadache
        ? headache.headache_worsened_by_neck_manoeuvres ?? false
        : false,
      distinct_attack_count: 0,
      headache_days_per_month: 0,
      migrainous_days_per_month: 0,
      observation_months: 0,
      attack_frequency_per_day: hasHeadache
        ? headache.attack_frequency_per_day ?? 1
        : 0,
      bout_pattern: headache.bout_pattern ?? "episodic",
      onset_pattern: headache.onset_pattern ?? "gradual",
      acute_med_days_per_month: 0,
      med_class: headache.med_class ?? "none",
      pre_existing_primary_headache: headache.pre_existing_primary_headache ?? false,
      meds: hasMeds ? headache.meds?.length ? headache.meds : ["acute medication"] : [],
      meds_other: headache.meds_other,
      indomethacin_response: headache.indomethacin_response ?? "not_tested",
      cervical_imaging_or_clinical_evidence:
        headache.cervical_imaging_or_clinical_evidence ?? false,
      nerve_block_abolishes_headache:
        headache.nerve_block_abolishes_headache ?? "not_tested",
      better_accounted_by_other_dx: headache.better_accounted_by_other_dx ?? false,
      note: hasHeadache ? headache.note : "No headache logged.",
      created_at: `${date}T08:00:00.000Z`,
      updated_at: `${date}T08:00:00.000Z`,
      _dirty: 0,
    };
    return entry;
  });
}

function fixture(input: {
  id: string;
  source: PublicCaseSource;
  notes: string;
  headacheDays: Set<number>;
  patch: EntryPatch;
  medDays?: Set<number>;
  profile?: ProfilePatch;
  expectedDx?: string[];
  observationLimitedDx?: string[];
  expectedCauseIds?: string[];
  expectedMohAtRisk?: boolean;
}): PublicCaseFixture {
  return {
    id: input.id,
    source: input.source,
    notes: input.notes,
    entries: buildEntries(input.id, input.headacheDays, input.patch, input.medDays),
    profile: buildProfile(input.profile),
    expectedDx: input.expectedDx ?? [],
    observationLimitedDx: input.observationLimitedDx,
    expectedCauseIds: input.expectedCauseIds,
    expectedMohAtRisk: input.expectedMohAtRisk,
  };
}

const auraPatch: EntryPatch = {
  aura: true,
  aura_types: ["visual", "sensory"],
  aura_fully_reversible: true,
  aura_spreads_over_5min: true,
  aura_symptoms_in_succession: true,
  aura_each_5to60min: true,
  aura_at_least_one_unilateral: true,
  aura_at_least_one_positive: true,
  aura_followed_by_headache_60min: true,
};

const clusterPatch: EntryPatch = {
  worst: 9,
  duration_hours: 0.75,
  laterality: "unilateral",
  side_locked: true,
  quality: "stabbing",
  intensity: 9,
  aggravated_by_activity: false,
  nausea: "none",
  photophobia: false,
  phonophobia: false,
  pain_regions: ["orbital", "temporal"],
  conjunctival_injection_or_lacrimation: true,
  nasal_congestion_or_rhinorrhoea: true,
  restlessness_or_agitation: true,
  attack_frequency_per_day: 2,
  bout_pattern: "episodic",
};

const phPatch: EntryPatch = {
  ...clusterPatch,
  duration_hours: 0.25,
  attack_frequency_per_day: 8,
  indomethacin_response: "absolute",
};

const hcPatch: EntryPatch = {
  worst: 7,
  duration_hours: 24,
  laterality: "unilateral",
  side_locked: true,
  quality: "other",
  intensity: 7,
  aggravated_by_activity: false,
  nausea: "none",
  photophobia: false,
  phonophobia: false,
  pain_regions: ["temporal", "orbital"],
  conjunctival_injection_or_lacrimation: true,
  nasal_congestion_or_rhinorrhoea: true,
  attack_frequency_per_day: 1,
  indomethacin_response: "absolute",
  bout_pattern: "chronic",
};

const ndphPatch: EntryPatch = {
  worst: 5,
  duration_hours: 24,
  laterality: "bilateral",
  quality: "pressing_tightening",
  intensity: 5,
  aggravated_by_activity: false,
  nausea: "none",
  photophobia: false,
  phonophobia: false,
  pain_regions: ["whole_head"],
  onset_pattern: "daily_unremitting_from_onset_within_24h",
  bout_pattern: "chronic",
};

const cervicogenicPatch: EntryPatch = {
  worst: 6,
  duration_hours: 10,
  laterality: "unilateral",
  side_locked: true,
  quality: "pressing_tightening",
  intensity: 6,
  aggravated_by_activity: false,
  nausea: "none",
  photophobia: false,
  phonophobia: false,
  pain_regions: ["occipital"],
  neck_range_of_motion_reduced: true,
  headache_worsened_by_neck_manoeuvres: true,
  bout_pattern: "chronic",
};

export const publicCaseFixtures: PublicCaseFixture[] = [
  fixture({
    id: "mwa-myoclonus-pmc11464945",
    source: source(
      "PMC11464945",
      "Migraine With Aura Accompanied by Myoclonus: A Case Report",
      "migraine with aura",
    ),
    notes: "Visual aura followed by unilateral throbbing headache and vomiting.",
    headacheDays: spreadDays(6),
    patch: { ...auraPatch, vomiting: true, note: "Visual aura, vomiting, right throbbing pain." },
    expectedDx: ["1.2"],
  }),
  fixture({
    id: "mwa-menstrual-sensory-pmc3381070",
    source: source(
      "PMC3381070",
      "Pure menstrual migraine with sensory aura: a case report",
      "migraine with sensory aura",
    ),
    notes: "Menstrual migraine case with reversible sensory aura.",
    headacheDays: spreadDays(5),
    patch: { ...auraPatch, aura_types: ["sensory"], note: "Sensory aura before migraine." },
    expectedDx: ["1.2"],
  }),
  fixture({
    id: "mwa-pfo-closure-pmc11446259",
    source: source(
      "PMC11446259",
      "Resolution of Migraine with Aura Post-PFO Closure in a Young Female: A Case Report",
      "migraine with aura",
    ),
    notes: "Recurrent migraine with aura before closure.",
    headacheDays: spreadDays(7),
    patch: { ...auraPatch, aura_types: ["visual"], note: "Typical visual aura with headache." },
    expectedDx: ["1.2"],
  }),
  fixture({
    id: "mwa-aura-status-pmc10699829",
    source: source(
      "PMC10699829",
      "A Case of Migraine Aura Status in a Migraine Patient With Typical Aura",
      "migraine with typical aura / aura status",
    ),
    notes: "Typical aura history represented as repeated reversible aura attacks.",
    headacheDays: spreadDays(4),
    patch: { ...auraPatch, aura_types: ["visual"], note: "Recurrent visual aura pattern." },
    expectedDx: ["1.2"],
  }),
  fixture({
    id: "mwoa-fluorescent-trigger-pmc12665120",
    source: source(
      "PMC12665120",
      "Triggered Migraine Attack by Flickering Fluorescent Lights in an Assembly Line Worker: A Case Report",
      "triggered migraine attack",
    ),
    notes: "Triggered unilateral migraine-like attacks without aura.",
    headacheDays: spreadDays(6),
    patch: { note: "Fluorescent-light triggered throbbing migraine-like pain." },
    expectedDx: ["1.1"],
  }),
  fixture({
    id: "mwoa-neurocysticercosis-mimic-pmc4083102",
    source: source(
      "PMC4083102",
      "Cerebral neurocysticercosis mimicking or comorbid with episodic migraine?",
      "episodic migraine-like headache secondary mimic",
    ),
    notes: "A secondary mimic with attacks that still satisfy migraine-pattern diary criteria.",
    headacheDays: spreadDays(5),
    patch: { note: "Migraine-like attack; source later found a secondary mimic." },
    expectedDx: ["1.1"],
  }),
  fixture({
    id: "cm-anti-cgrp-pmc10198612",
    source: source(
      "PMC10198612",
      "A case report of a chronic migraine patient treated with three different anti-CGRP monoclonal antibodies",
      "chronic migraine",
    ),
    notes: "High-frequency migrainous days in a known chronic migraine case.",
    headacheDays: firstDays(22),
    patch: { note: "Near-daily migrainous headache." },
    expectedDx: ["1.1"],
    observationLimitedDx: ["1.3"],
  }),
  fixture({
    id: "cm-chiropractic-pmc2682939",
    source: source(
      "PMC2682939",
      "Chiropractic management of chronic migraine: a case report",
      "chronic migraine",
    ),
    notes: "Chronic migraine represented by frequent migrainous diary days.",
    headacheDays: firstDays(20),
    patch: { note: "Frequent migraine-pattern headache days." },
    expectedDx: ["1.1"],
    observationLimitedDx: ["1.3"],
  }),
  fixture({
    id: "cluster-sinonasal-pmc10902516",
    source: source(
      "PMC10902516",
      "Cluster Headache Presenting As Sinonasal Pathology in a Young Adult: A Diagnostic Odyssey",
      "cluster headache",
    ),
    notes: "Severe unilateral orbital/temporal attacks with cranial autonomic symptoms.",
    headacheDays: spreadDays(8),
    patch: { ...clusterPatch, note: "Short severe orbital attacks with nasal/eye autonomic symptoms." },
    profile: { facialPressureCongestion: true },
    expectedDx: ["3.1"],
    expectedCauseIds: ["rhinogenic"],
  }),
  fixture({
    id: "cluster-atypical-pmc5227136",
    source: source(
      "PMC5227136",
      "Chronic Cluster Headache with an Atypical Presentation and Treatment Response",
      "cluster headache",
    ),
    notes: "Cluster-like repeated short side-locked attacks.",
    headacheDays: spreadDays(10),
    patch: { ...clusterPatch, note: "Atypical but ICHD-cluster-compatible attack pattern." },
    expectedDx: ["3.1"],
  }),
  fixture({
    id: "cluster-myoclonus-pmc3325438",
    source: source(
      "PMC3325438",
      "A Case of Cluster Headache Accompanied by Myoclonus and Hemiparesis",
      "cluster headache",
    ),
    notes: "Cluster headache case with neurologic accompaniment, modeled by headache criteria only.",
    headacheDays: spreadDays(7),
    patch: { ...clusterPatch, note: "Severe unilateral orbital cluster-like headache." },
    expectedDx: ["3.1"],
  }),
  fixture({
    id: "cluster-sleep-pmc10184054",
    source: source(
      "PMC10184054",
      "A Rare Case of Cluster Headache Occurring Exclusively During Sleep Without Autonomic Symptoms and Agitation",
      "atypical cluster headache",
    ),
    notes: "Atypical source case; diary keeps the sleep-linked severe unilateral attack pattern.",
    headacheDays: spreadDays(7),
    patch: { ...clusterPatch, note: "Sleep-linked severe unilateral attacks." },
    expectedDx: ["3.1"],
  }),
  fixture({
    id: "ph-hypnic-comorbid-pmc11807410",
    source: source(
      "PMC11807410",
      "Co-morbid Indomethacin-Responsive Headaches in a Woman in Her Late 60s With Paroxysmal Hemicrania and Hypnic Headache",
      "paroxysmal hemicrania",
    ),
    notes: "Indomethacin-responsive short frequent unilateral attacks.",
    headacheDays: firstDays(22),
    patch: { ...phPatch, note: "Frequent brief indomethacin-responsive orbital attacks." },
    expectedDx: ["3.2"],
  }),
  fixture({
    id: "ph-pediatric-case1-pmc3072501",
    source: source(
      "PMC3072501",
      "Chronic paroxysmal hemicrania in paediatric age: report of two cases",
      "chronic paroxysmal hemicrania",
      "case 1",
    ),
    notes: "Pediatric case series, case 1 modeled as PH criteria-compatible.",
    headacheDays: firstDays(24),
    patch: { ...phPatch, note: "Pediatric frequent brief unilateral attacks." },
    expectedDx: ["3.2"],
  }),
  fixture({
    id: "ph-pediatric-case2-pmc3072501",
    source: source(
      "PMC3072501",
      "Chronic paroxysmal hemicrania in paediatric age: report of two cases",
      "chronic paroxysmal hemicrania",
      "case 2",
    ),
    notes: "Pediatric case series, case 2 modeled as PH criteria-compatible.",
    headacheDays: firstDays(21),
    patch: { ...phPatch, note: "Second pediatric PH pattern." },
    expectedDx: ["3.2"],
  }),
  fixture({
    id: "ph-stroke-mimic-pmc7542950",
    source: source(
      "PMC7542950",
      "Paroxysmal hemicrania masquerading as a stroke in an elderly gentleman: case report",
      "paroxysmal hemicrania",
    ),
    notes: "Elderly patient with PH masquerading as stroke.",
    headacheDays: firstDays(20),
    patch: { ...phPatch, note: "Frequent unilateral brief attacks, indomethacin-responsive." },
    expectedDx: ["3.2"],
  }),
  fixture({
    id: "hc-rhinosinusitis-pmc11824416",
    source: source(
      "PMC11824416",
      "Hemicrania continua with rhinosinusitis: a case report",
      "hemicrania continua",
    ),
    notes: "Continuous side-locked headache with autonomic/rhinosinusitis overlap.",
    headacheDays: firstDays(30),
    patch: { ...hcPatch, note: "Continuous unilateral headache with nasal/eye symptoms." },
    profile: { facialPressureCongestion: true },
    observationLimitedDx: ["3.4"],
    expectedCauseIds: ["rhinogenic"],
  }),
  fixture({
    id: "hc-remitting-pmc6536239",
    source: source(
      "PMC6536239",
      "Remitting hemicrania continua: case report",
      "hemicrania continua",
    ),
    notes: "Side-locked continuous hemicrania pattern in a 30-day window.",
    headacheDays: firstDays(30),
    patch: { ...hcPatch, note: "Continuous unilateral headache." },
    observationLimitedDx: ["3.4"],
  }),
  fixture({
    id: "hc-aneurysm-pmc7938477",
    source: source(
      "PMC7938477",
      "Hemicrania continua associated with an unruptured anterior communicating artery aneurysm: first case report",
      "hemicrania continua-like headache with secondary association",
    ),
    notes: "Continuous unilateral headache associated with a structural finding.",
    headacheDays: firstDays(30),
    patch: { ...hcPatch, better_accounted_by_other_dx: true, note: "Continuous unilateral headache; source had secondary association." },
    observationLimitedDx: ["3.4"],
  }),
  fixture({
    id: "ndph-erenumab-pmc12178447",
    source: source(
      "PMC12178447",
      "Complete Resolution of New Daily Persistent Headache With Migraine-Like Features Following Erenumab Treatment: A Case Report",
      "new daily persistent headache",
    ),
    notes: "Clear daily-from-onset pattern with migraine-like features.",
    headacheDays: firstDays(30),
    patch: { ...ndphPatch, quality: "pulsating", nausea: "mild", photophobia: true, note: "Daily from a clear start day." },
    observationLimitedDx: ["4.10"],
  }),
  fixture({
    id: "ndph-postinfectious-pmc12959850",
    source: source(
      "PMC12959850",
      "Steroid-Responsive, Post-infectious New Daily Persistent Headache With Mild Cerebrospinal Fluid Pleocytosis: A Case Report",
      "post-infectious new daily persistent headache",
    ),
    notes: "Post-infectious daily unremitting headache.",
    headacheDays: firstDays(30),
    patch: { ...ndphPatch, note: "Post-infectious daily unremitting headache." },
    profile: { recentRespiratoryInfection: true },
    observationLimitedDx: ["4.10"],
  }),
  fixture({
    id: "ndph-botox-pmc4715056",
    source: source(
      "PMC4715056",
      "Botulinum toxin type A therapy for new daily persistent headache",
      "new daily persistent headache",
    ),
    notes: "NDPH case modeled by daily unremitting onset.",
    headacheDays: firstDays(30),
    patch: { ...ndphPatch, note: "Daily persistent headache pattern." },
    observationLimitedDx: ["4.10"],
  }),
  fixture({
    id: "ndph-venlafaxine-pmc6503587",
    source: source(
      "PMC6503587",
      "Resolution of new daily persistent headache by a tumor necrosis factor alpha antagonist, Venlafaxine",
      "new daily persistent headache",
    ),
    notes: "NDPH case represented by a 30-day daily-from-onset diary slice.",
    headacheDays: firstDays(30),
    patch: { ...ndphPatch, note: "Daily from onset; 30-day validation slice." },
    observationLimitedDx: ["4.10"],
  }),
  fixture({
    id: "moh-screening-pmc9159379",
    source: source(
      "PMC9159379",
      "Screening for Medication Overuse Headache Can Reduce Patients' Suffering From Chronic Daily Headache: A Case Report",
      "medication-overuse headache",
    ),
    notes: "Chronic daily headache with frequent acute medication exposure.",
    headacheDays: firstDays(24),
    medDays: firstDays(18),
    patch: {
      med_class: "simple_nonopioid",
      pre_existing_primary_headache: true,
      meds: ["simple analgesic"],
      note: "Frequent acute medication use with chronic daily headache.",
    },
    expectedDx: ["1.1"],
    observationLimitedDx: ["8.2"],
    expectedMohAtRisk: true,
  }),
  fixture({
    id: "moh-electroacupuncture-pmc11076970",
    source: source(
      "PMC11076970",
      "Effects of electroacupuncture on treatment-resistant chronic migraine with medication overuse headache",
      "chronic migraine with medication-overuse headache",
    ),
    notes: "Treatment-resistant chronic migraine plus medication overuse.",
    headacheDays: firstDays(22),
    medDays: firstDays(15),
    patch: {
      med_class: "triptan",
      pre_existing_primary_headache: true,
      meds: ["triptan"],
      note: "Triptan overuse in chronic migraine pattern.",
    },
    expectedDx: ["1.1"],
    observationLimitedDx: ["1.3", "8.2"],
    expectedMohAtRisk: true,
  }),
  fixture({
    id: "moh-kampo-tj54-pmc8553297",
    source: source(
      "PMC8553297",
      "Medication Overuse Headache Successfully Treated by Japanese Herbal Kampo Medicine",
      "medication-overuse headache",
    ),
    notes: "MOH case represented with daily headache and combination-analgesic exposure.",
    headacheDays: firstDays(23),
    medDays: firstDays(14),
    patch: {
      med_class: "combination_analgesic",
      pre_existing_primary_headache: true,
      meds: ["combination analgesic"],
      note: "Medication-overuse pattern.",
    },
    expectedDx: ["1.1"],
    observationLimitedDx: ["8.2"],
    expectedMohAtRisk: true,
  }),
  fixture({
    id: "cervical-disc-pmc11258748",
    source: source(
      "PMC11258748",
      "Cervicogenic Headache due to Lower Segment Cervical Disk Herniation: A Case Report",
      "cervicogenic headache",
    ),
    notes: "Neck-provoked occipital headache with cervical structural evidence.",
    headacheDays: firstDays(18),
    patch: {
      ...cervicogenicPatch,
      cervical_imaging_or_clinical_evidence: true,
      nerve_block_abolishes_headache: "yes",
      note: "Occipital pain provoked by neck movement; cervical evidence present.",
    },
    profile: { recentHeadNeckTrauma: false, workup: { cervicalImaging: "abnormal", nerveBlock: "abnormal" } },
    expectedDx: ["11.2.1"],
    expectedCauseIds: ["cervicogenic"],
  }),
  fixture({
    id: "manual-therapy-cgh-pmc2565596",
    source: source(
      "PMC2565596",
      "Orthopaedic Manual Physical Therapy Including Thrust Manipulation and Exercise in the Management of a Patient With Cervicogenic Headache: A Case Report",
      "cervicogenic headache",
    ),
    notes: "Cervicogenic headache case modeled without confirmatory nerve block.",
    headacheDays: firstDays(18),
    patch: { ...cervicogenicPatch, note: "Neck movement provokes occipital headache." },
    profile: { workup: { cervicalImaging: "not_done", nerveBlock: "not_done" } },
    expectedDx: ["11.2.1"],
    expectedCauseIds: ["cervicogenic"],
  }),
  fixture({
    id: "directional-cgh-pmc10642309",
    source: source(
      "PMC10642309",
      "Utilizing directional preference in the management of cervicogenic headache: a case series",
      "cervicogenic headache",
      "case-series representative",
    ),
    notes: "Case-series representative with directional neck preference.",
    headacheDays: firstDays(16),
    patch: { ...cervicogenicPatch, note: "Directional neck preference changes headache." },
    expectedDx: ["11.2.1"],
    expectedCauseIds: ["cervicogenic"],
  }),
  fixture({
    id: "c2-prf-cgh-pmc3173620",
    source: source(
      "PMC3173620",
      "Pulsed radiofrequency of the second cervical ganglion for cervicogenic headache",
      "cervicogenic headache",
    ),
    notes: "C2-targeted cervicogenic headache case represented as occipital neck-provoked pain.",
    headacheDays: firstDays(17),
    patch: {
      ...cervicogenicPatch,
      cervical_imaging_or_clinical_evidence: true,
      nerve_block_abolishes_headache: "yes",
      note: "C2-related occipital headache pattern.",
    },
    profile: { workup: { cervicalImaging: "abnormal", nerveBlock: "abnormal" } },
    expectedDx: ["11.2.1"],
    expectedCauseIds: ["cervicogenic"],
  }),
];
