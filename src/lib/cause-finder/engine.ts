// Cause Finder — the engine.
//
// Complements the ICHD-3 primary-headache engine (which lists migraine/TTH/etc.).
// This adds the half that standard visits miss: secondary & fixable causes,
// cranial neuralgias, the danger ("don't-miss") causes, medication-overuse, and
// a treatment-mismatch check — each with the SPECIFIC next test + specialist.
//
// Pure functions over the diary + profile. Reads structured fields only, never
// the free-text note. Decision support, never a diagnosis.

import type { Entry } from "@/lib/db";
import type { CauseProfile } from "./profile";
import type {
  CauseCandidate,
  CauseReport,
  MohStatus,
  RedFlag,
  TreatmentMismatch,
  WorkupGap,
} from "./types";

const DISCLAIMER =
  "Decision support, not a diagnosis. The Cause Finder matches your logged pattern against known causes and points to the test that confirms or rules each out. Bring it to a clinician — they make the diagnosis.";

/* ------------------------------------------------------------------ */
/* Diary summary                                                       */
/* ------------------------------------------------------------------ */

interface Summary {
  totalDays: number;
  headacheDays: number;
  avgWorst: number;
  trendRising: boolean;
  // location
  occipitalNeckFrac: number;
  orbitalEyeFrac: number;
  templeFrac: number;
  // quality
  pressingFrac: number;
  pulsatingFrac: number;
  stabbingFrac: number;
  // laterality
  unilateralFrac: number;
  sideLockedFrac: number;
  // associated
  photophobiaFrac: number;
  phonophobiaFrac: number;
  nauseaFrac: number;
  autonomicFrac: number;
  nasalFrac: number;
  restlessFrac: number;
  auraFrac: number;
  neckProvokedFrac: number;
  migrainousFrac: number;
  // course (from most-recent entry's snapshot)
  headacheDaysPerMonth: number;
  observationMonths: number;
  onsetSuddenDaily: boolean;
  acuteMedDaysPerMonth: number;
  medClass: string;
  meds: string[];
}

function regionHit(e: Entry, needles: string[]): boolean {
  return (e.regions ?? []).some((r) =>
    needles.some((n) => r.regionId.includes(n)),
  );
}

function summarize(entries: Entry[]): Summary {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const hd = sorted.filter((e) => !e.no_headache);
  const n = hd.length || 1;
  const frac = (pred: (e: Entry) => boolean) =>
    hd.filter(pred).length / n;

  const worst = hd.map((e) => e.worst);
  const avgWorst = worst.length
    ? worst.reduce((a, b) => a + b, 0) / worst.length
    : 0;

  // crude progression: mean worst of last third vs first third
  let trendRising = false;
  if (hd.length >= 6) {
    const k = Math.floor(hd.length / 3);
    const mean = (arr: Entry[]) =>
      arr.reduce((s, e) => s + e.worst, 0) / (arr.length || 1);
    trendRising = mean(hd.slice(-k)) - mean(hd.slice(0, k)) >= 1.5;
  }

  const latest = hd[hd.length - 1] ?? sorted[sorted.length - 1];

  return {
    totalDays: sorted.length,
    headacheDays: hd.length,
    avgWorst,
    trendRising,
    occipitalNeckFrac: frac(
      (e) =>
        e.pain_regions.includes("occipital") ||
        regionHit(e, ["occiput", "neck", "subocciput", "trapezius"]),
    ),
    orbitalEyeFrac: frac(
      (e) =>
        e.pain_regions.includes("orbital") ||
        e.pain_regions.includes("supraorbital") ||
        regionHit(e, ["eye"]),
    ),
    templeFrac: frac(
      (e) => e.pain_regions.includes("temporal") || regionHit(e, ["temple"]),
    ),
    pressingFrac: frac((e) => e.quality === "pressing_tightening"),
    pulsatingFrac: frac((e) => e.quality === "pulsating"),
    stabbingFrac: frac((e) => e.quality === "stabbing"),
    unilateralFrac: frac((e) => e.laterality === "unilateral"),
    sideLockedFrac: frac((e) => e.side_locked),
    photophobiaFrac: frac((e) => e.photophobia),
    phonophobiaFrac: frac((e) => e.phonophobia),
    nauseaFrac: frac((e) => e.nausea !== "none"),
    autonomicFrac: frac(
      (e) =>
        e.conjunctival_injection_or_lacrimation ||
        e.eyelid_oedema ||
        e.miosis_or_ptosis ||
        e.forehead_facial_sweating,
    ),
    nasalFrac: frac((e) => e.nasal_congestion_or_rhinorrhoea),
    restlessFrac: frac((e) => e.restlessness_or_agitation),
    auraFrac: frac((e) => e.aura),
    neckProvokedFrac: frac(
      (e) =>
        e.neck_range_of_motion_reduced ||
        e.headache_worsened_by_neck_manoeuvres,
    ),
    migrainousFrac: frac(
      (e) =>
        e.quality === "pulsating" &&
        (e.intensity ?? e.worst ?? 0) >= 6 &&
        (e.nausea !== "none" || (e.photophobia && e.phonophobia)),
    ),
    headacheDaysPerMonth: latest?.headache_days_per_month ?? 0,
    observationMonths: latest?.observation_months ?? 0,
    onsetSuddenDaily:
      (latest?.onset_pattern ?? "") ===
      "daily_unremitting_from_onset_within_24h",
    acuteMedDaysPerMonth: latest?.acute_med_days_per_month ?? 0,
    medClass: latest?.med_class ?? "none",
    meds: Array.from(new Set(hd.flatMap((e) => e.meds ?? []))),
  };
}

/* ------------------------------------------------------------------ */
/* Red flags (SNNOOP10)                                                */
/* ------------------------------------------------------------------ */

function redFlags(s: Summary, p: CauseProfile): RedFlag[] {
  const out: RedFlag[] = [];
  const add = (
    id: string,
    label: string,
    detail: string,
    action: string,
    urgency: RedFlag["urgency"],
  ) => out.push({ id, label, detail, action, urgency });

  if (p.thunderclapEver)
    add(
      "onset-thunderclap",
      "Sudden 'thunderclap' onset",
      "You reported a headache that hit maximum intensity in under a minute.",
      "A thunderclap headache needs emergency assessment (CT + sometimes lumbar puncture) to rule out a bleed. Go to the ER for any new one.",
      "emergency",
    );
  if (p.neuroDeficit)
    add(
      "neuro-deficit",
      "Neurological symptoms",
      "Weakness, numbness, speech trouble or confusion reported (beyond typical aura).",
      "New neurological deficits need urgent evaluation. Seek urgent care today.",
      "emergency",
    );
  if (p.eyeRednessHalos)
    add(
      "eye-acute",
      "Red, painful eye with halos",
      "Eye pain with a red eye and halos around lights.",
      "This can be acute angle-closure glaucoma — sight-threatening. Go to an eye casualty / ER now.",
      "emergency",
    );
  if (p.visionLossOrField)
    add(
      "vision-loss",
      "Vision loss or visual-field change",
      "Loss of vision or a field defect reported.",
      "Needs urgent eye / neuro-ophthalmology assessment.",
      "urgent",
    );
  if (p.feverOrSystemic)
    add(
      "systemic",
      "Fever / systemic symptoms",
      "Headache with fever, neck stiffness or weight loss.",
      "Rule out infection (e.g. meningitis) — see a doctor promptly; ER if neck stiffness + fever.",
      "urgent",
    );
  if (p.newOnsetOver50)
    add(
      "older-onset",
      "New headache after age 50",
      "A new or changed headache starting after 50.",
      "Warrants work-up (incl. giant-cell arteritis bloods/ESR). See a doctor soon.",
      "urgent",
    );
  if (p.cancerHistory)
    add(
      "neoplasm",
      "Cancer history",
      "A new or changed headache with a history of cancer.",
      "Should be imaged. Tell your doctor and ask about a brain MRI.",
      "urgent",
    );
  if (p.immuneCompromise)
    add(
      "immune",
      "Reduced immunity",
      "Headache with immune compromise (HIV, immunosuppression).",
      "Lowers the threshold for imaging/work-up — see a doctor.",
      "urgent",
    );
  if (p.pregnant)
    add(
      "pregnancy",
      "Pregnancy / postpartum",
      "New or worsening headache in pregnancy or postpartum.",
      "Needs review (blood pressure, pre-eclampsia, venous thrombosis). Contact your maternity team.",
      "urgent",
    );
  if (p.recentHeadNeckTrauma)
    add(
      "trauma",
      "Recent head/neck injury",
      "Headache following a recent head or neck injury.",
      "Ask your doctor about post-traumatic causes and whether imaging is needed.",
      "urgent",
    );
  if (p.positional === "worse_upright")
    add(
      "positional-upright",
      "Worse when upright, better lying down",
      "An orthostatic pattern (better when lying flat).",
      "This points to low CSF pressure / a spinal-fluid leak (SIH). Ask a neurologist about brain MRI with contrast.",
      "urgent",
    );
  if (p.positional === "worse_lying" || p.positional === "worse_valsalva")
    add(
      "positional-lying",
      "Worse lying down / with straining",
      "Worse when lying or with coughing/straining (Valsalva).",
      "Can indicate raised intracranial pressure. Ask about an eye exam for papilledema and neuro-ophthalmology.",
      "urgent",
    );
  if (p.pulsatileTinnitus && p.transientVisualObscurations)
    add(
      "iih",
      "Pulsatile tinnitus + visual blackouts",
      "Whooshing in the ear with brief greying of vision.",
      "Suggests idiopathic intracranial hypertension (IIH). Needs eye exam (papilledema) + neuro-ophthalmology.",
      "urgent",
    );
  if (s.trendRising)
    add(
      "progressive",
      "Progressive pattern",
      "Your logged severity has been trending upward.",
      "A steadily worsening headache should be reviewed by a doctor.",
      "urgent",
    );

  return out;
}

/* ------------------------------------------------------------------ */
/* Cause candidates (secondary / neuralgia / emergency)                */
/* ------------------------------------------------------------------ */

function candidates(s: Summary, p: CauseProfile): CauseCandidate[] {
  const list: CauseCandidate[] = [];

  // --- Cervicogenic (the most-missed; ICHD 11.2.1) ---
  {
    const matched: string[] = [];
    const against: string[] = [];
    if (s.neckProvokedFrac >= 0.3)
      matched.push("headache provoked by neck movement / stiff neck");
    if (s.occipitalNeckFrac >= 0.3)
      matched.push("pain at the back of head / neck");
    if (s.sideLockedFrac >= 0.5) matched.push("always the same side");
    if (p.recentHeadNeckTrauma) matched.push("recent head/neck injury");
    if (s.pulsatingFrac > 0.6)
      against.push("mostly throbbing (more migraine-like)");
    if (matched.length)
      list.push({
        id: "cervicogenic",
        name: "Cervicogenic headache (neck-driven)",
        code: "11.2.1",
        category: "secondary",
        urgency: "routine",
        score: 0.4 * s.neckProvokedFrac + 0.3 * s.occipitalNeckFrac + 0.3 * s.sideLockedFrac,
        matched,
        against,
        confirmingTest:
          "A diagnostic nerve block (greater occipital / C2–C3) that abolishes the pain. An MRI alone cannot confirm it — it only rules other things out.",
        specialist: "Pain clinic / anaesthetist for the block; physiotherapist for assessment",
        whatToSay:
          "My pain is one-sided, sits at the back of my head/neck and is provoked by neck movement — can we consider cervicogenic headache and a diagnostic nerve block, not just an MRI?",
        note: "Cervical MRI showing degeneration is common and does NOT prove cervicogenic — the nerve block is the confirmer.",
      });
  }

  // --- Rhinogenic / sinus ---
  {
    const matched: string[] = [];
    if (s.nasalFrac >= 0.3) matched.push("nasal congestion / runny nose with the pain");
    if (p.facialPressureCongestion) matched.push("facial pressure / fullness");
    if (p.recentRespiratoryInfection) matched.push("recent cold / infection");
    if (s.orbitalEyeFrac >= 0.3) matched.push("pain around the eyes / forehead");
    if (matched.length >= 2)
      list.push({
        id: "rhinogenic",
        name: "Sinus / nasal cause (rhinogenic)",
        category: "secondary",
        urgency: "routine",
        score: 0.4 * s.nasalFrac + (p.facialPressureCongestion ? 0.3 : 0) + (p.recentRespiratoryInfection ? 0.3 : 0),
        matched,
        against: s.photophobiaFrac > 0.5 ? ["light sensitivity is common in migraine too — many 'sinus headaches' are actually migraine"] : [],
        confirmingTest: "Nasal endoscopy and/or CT of the sinuses showing active disease that matches the pain.",
        specialist: "ENT (otolaryngology)",
        whatToSay:
          "My headaches come with nasal congestion/facial pressure — can we check the sinuses (endoscopy or CT) rather than assume migraine?",
        note: "Caution: studies show many 'sinus headaches' are migraine. Real sinus disease must be confirmed on imaging/endoscopy.",
      });
  }

  // --- Occipital neuralgia ---
  {
    const matched: string[] = [];
    if (s.occipitalNeckFrac >= 0.4) matched.push("pain at the base of the skull / back of head");
    if (s.stabbingFrac >= 0.3) matched.push("sharp / shooting / electric-shock quality");
    if (matched.length >= 2)
      list.push({
        id: "occipital-neuralgia",
        name: "Occipital neuralgia",
        category: "neuralgia",
        urgency: "routine",
        score: 0.5 * s.occipitalNeckFrac + 0.5 * s.stabbingFrac,
        matched,
        against: [],
        confirmingTest: "Tenderness over the occipital nerve and relief from a diagnostic occipital nerve block.",
        specialist: "Neurologist / pain clinic",
        whatToSay:
          "I get sharp, shooting pain from the base of my skull — could this be occipital neuralgia, and could a nerve block help confirm it?",
      });
  }

  // --- Trigeminal neuralgia ---
  {
    const matched: string[] = [];
    if (s.stabbingFrac >= 0.4) matched.push("brief electric-shock / stabbing pains");
    if (s.unilateralFrac >= 0.7) matched.push("strictly one side, in the face");
    if (matched.length >= 2)
      list.push({
        id: "trigeminal-neuralgia",
        name: "Trigeminal neuralgia",
        category: "neuralgia",
        urgency: "routine",
        score: 0.6 * s.stabbingFrac + 0.4 * s.unilateralFrac,
        matched,
        against: [],
        confirmingTest: "Clinical pattern (triggered by touch/chewing) + MRI to look for nerve–vessel contact or other lesion.",
        specialist: "Neurologist",
        whatToSay:
          "I get sudden electric-shock facial pains triggered by light touch or chewing — could this be trigeminal neuralgia?",
      });
  }

  // --- TMJ / dental ---
  {
    const matched: string[] = [];
    if (p.jawClickOrPainChewing) matched.push("jaw clicks or hurts with chewing");
    if (p.bruxism) matched.push("teeth grinding / morning jaw tightness");
    if (s.templeFrac >= 0.3) matched.push("pain in the temples");
    if (matched.length >= 2)
      list.push({
        id: "tmj",
        name: "Jaw joint (TMJ) / dental cause",
        category: "secondary",
        urgency: "routine",
        score: (p.jawClickOrPainChewing ? 0.4 : 0) + (p.bruxism ? 0.3 : 0) + 0.3 * s.templeFrac,
        matched,
        against: [],
        confirmingTest: "Dental / orofacial exam of the jaw joint and bite; a night-guard trial often helps.",
        specialist: "Dentist / orofacial-pain specialist",
        whatToSay:
          "My headaches sit in my temples and my jaw clicks/aches — can we check for a TMJ or dental cause?",
      });
  }

  // --- Acute angle-closure glaucoma (EMERGENCY) ---
  if (p.eyeRednessHalos)
    list.push({
      id: "glaucoma",
      name: "Acute angle-closure glaucoma",
      category: "emergency",
      urgency: "emergency",
      score: 1,
      matched: ["red, painful eye with halos around lights"],
      against: [],
      confirmingTest: "Measure intra-ocular pressure (IOP) — same-day.",
      specialist: "Eye casualty / emergency ophthalmology — NOW",
      whatToSay:
        "I have eye pain with a red eye and halos around lights — I need my eye pressure checked urgently.",
      note: "Sight-threatening. Do not wait.",
    });

  // --- IIH (idiopathic intracranial hypertension) ---
  {
    const matched: string[] = [];
    if (p.pulsatileTinnitus) matched.push("pulsatile (whooshing) tinnitus");
    if (p.transientVisualObscurations) matched.push("brief greying / blackouts of vision");
    if (p.positional === "worse_lying" || p.positional === "worse_valsalva")
      matched.push("worse lying down or with straining");
    if (matched.length >= 1)
      list.push({
        id: "iih",
        name: "Idiopathic intracranial hypertension (IIH)",
        category: "secondary",
        urgency: matched.length >= 2 ? "urgent" : "routine",
        score: 0.4 * (p.pulsatileTinnitus ? 1 : 0) + 0.4 * (p.transientVisualObscurations ? 1 : 0) + 0.2,
        matched,
        against: [],
        confirmingTest: "Dilated eye exam for papilledema, then MRI/MRV and lumbar puncture opening pressure.",
        specialist: "Neuro-ophthalmology / neurology",
        whatToSay:
          "I have whooshing in my ear and brief vision blackouts with my headaches — can my optic discs be checked for raised pressure (IIH)?",
      });
  }

  // --- SIH / CSF leak ---
  if (p.positional === "worse_upright")
    list.push({
      id: "sih",
      name: "Spinal-fluid leak / low CSF pressure (SIH)",
      category: "secondary",
      urgency: "urgent",
      score: 0.7 + (p.hypermobile ? 0.2 : 0),
      matched: [
        "worse upright, better lying flat",
        ...(p.hypermobile ? ["hypermobile / very flexible (raises the odds)"] : []),
      ],
      against: [],
      confirmingTest: "Brain MRI with contrast (looks for the SIH signature); sometimes spinal imaging to find the leak.",
      specialist: "Neurologist (ideally a headache/CSF specialist)",
      whatToSay:
        "My headache is clearly worse when I'm upright and eases when I lie flat — can we look for a CSF leak with a contrast brain MRI?",
    });

  // --- Sleep / obstructive sleep apnea ---
  if (p.workup.sleepStudy === "not_done" && s.avgWorst > 0)
    list.push({
      id: "sleep",
      name: "Sleep-related (incl. sleep apnea)",
      category: "secondary",
      urgency: "routine",
      score: 0.25,
      matched: ["headaches present on waking are often sleep-related"],
      against: [],
      confirmingTest: "A sleep study (especially if you snore, wake unrefreshed, or have morning headaches).",
      specialist: "Sleep clinic / GP referral",
      whatToSay:
        "I often wake with a headache — could a sleep study check for sleep apnea?",
      note: "Worth considering only if mornings are your worst time / you have sleep symptoms.",
    });

  // --- Eye strain / refractive / computer vision ---
  if (s.orbitalEyeFrac >= 0.4 && p.workup.eyeExamIOP === "not_done")
    list.push({
      id: "eye-strain",
      name: "Refractive error / digital eye strain",
      category: "secondary",
      urgency: "routine",
      score: 0.3 * s.orbitalEyeFrac,
      matched: ["pain centred around/behind the eyes"],
      against: [],
      confirmingTest: "A full eye exam (refraction + eye pressure). Try the 20-20-20 rule and screen breaks.",
      specialist: "Optometrist / ophthalmologist",
      whatToSay:
        "My headaches sit behind my eyes and get worse on screens — can I have a full eye exam including pressure?",
    });

  return list
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Medication-overuse, treatment-mismatch, workup gaps                 */
/* ------------------------------------------------------------------ */

function mohStatus(s: Summary): MohStatus {
  const simple = s.medClass === "simple_nonopioid" || s.medClass === "none";
  const threshold = simple ? 15 : 10;
  const atRisk = s.acuteMedDaysPerMonth >= threshold;
  return {
    atRisk,
    acuteMedDaysPerMonth: s.acuteMedDaysPerMonth,
    threshold,
    medClass: s.medClass,
    message: atRisk
      ? `You're using acute painkillers on ~${s.acuteMedDaysPerMonth} days/month (the medication-overuse line for your med type is ${threshold}). Regular overuse can itself drive a daily 'rebound' headache. This is a common, fixable trap — ask your doctor about a preventive-first, doctor-guided step-down.`
      : `Acute painkiller use (~${s.acuteMedDaysPerMonth} days/month) is below the medication-overuse line (${threshold}). Keep it occasional.`,
  };
}

function treatmentMismatch(s: Summary, p: CauseProfile): TreatmentMismatch {
  const looksTensionOrNeck =
    s.pressingFrac >= 0.5 && s.pulsatingFrac < 0.3 && s.migrainousFrac < 0.2;
  const onMigraineOnlyTx =
    p.treatmentsTried.includes("triptan") ||
    p.treatmentsTried.includes("cgrp");
  const missingTensionTx =
    !p.treatmentsTried.includes("physio") &&
    !p.treatmentsTried.includes("nerve_block") &&
    !p.treatmentsTried.includes("amitriptyline");
  if (looksTensionOrNeck && onMigraineOnlyTx && missingTensionTx)
    return {
      present: true,
      message:
        "Your pattern looks tension-type / neck-driven (pressing, not throbbing, little nausea), but the treatments tried are migraine-specific (triptans/CGRP), which target a different mechanism. Ask whether the daily-driver layer is being treated — e.g. neck-directed physiotherapy, a nerve block, or a preventive like amitriptyline.",
    };
  return { present: false, message: "" };
}

function workupGaps(
  s: Summary,
  p: CauseProfile,
  cands: CauseCandidate[],
): WorkupGap[] {
  const gaps: WorkupGap[] = [];
  const w = p.workup;
  const has = (id: string) => cands.some((c) => c.id === id);

  if (has("cervicogenic") && w.nerveBlock === "not_done")
    gaps.push({
      test: "Diagnostic nerve block (occipital / C2–C3)",
      reason: "It's the only thing that confirms cervicogenic headache — and it hasn't been done.",
      done: false,
    });
  if (has("rhinogenic") && w.ctSinus === "not_done")
    gaps.push({
      test: "CT of the sinuses / nasal endoscopy",
      reason: "Your pattern has nasal features but the sinuses haven't been imaged.",
      done: false,
    });
  if ((has("iih") || has("sih")) && w.lumbarPuncture === "not_done")
    gaps.push({
      test: "Eye exam for papilledema (± lumbar puncture opening pressure)",
      reason: "Your pattern points to a CSF-pressure problem that a pressure check would settle.",
      done: false,
    });
  if ((has("glaucoma") || has("eye-strain")) && w.eyeExamIOP === "not_done")
    gaps.push({
      test: "Full eye exam with intra-ocular pressure",
      reason: "Eye-centred pain warrants checking the eye pressure and refraction.",
      done: false,
    });
  if (has("sleep") && w.sleepStudy === "not_done")
    gaps.push({
      test: "Sleep study",
      reason: "Morning/sleep-linked headaches can be sleep-apnea related.",
      done: false,
    });
  if (s.headacheDaysPerMonth >= 15 && w.brainMRI === "not_done")
    gaps.push({
      test: "Brain MRI",
      reason: "A near-daily headache is usually worth one structural scan to rule out a secondary cause.",
      done: false,
    });
  return gaps;
}

function twoLayerMessage(s: Summary): string | null {
  if (
    s.headacheDaysPerMonth >= 15 &&
    s.pressingFrac > 0.2 &&
    s.migrainousFrac > 0
  )
    return "Your data looks like TWO overlapping problems: a near-daily baseline (tension/neck-type) PLUS occasional migraine-type attacks on top. These need different treatments — if only one is treated, the other keeps you unwell. Make sure both layers are addressed.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export function runCauseFinder(
  entries: Entry[],
  profile: CauseProfile,
): CauseReport {
  const s = summarize(entries);
  const flags = redFlags(s, profile);
  const cands = candidates(s, profile);
  return {
    daysLogged: s.totalDays,
    emergencies: flags.filter((f) => f.urgency === "emergency"),
    redFlags: flags.filter((f) => f.urgency !== "emergency"),
    candidates: cands,
    moh: mohStatus(s),
    mismatch: treatmentMismatch(s, profile),
    workupGaps: workupGaps(s, profile, cands),
    twoLayer: twoLayerMessage(s),
    disclaimer: DISCLAIMER,
  };
}
