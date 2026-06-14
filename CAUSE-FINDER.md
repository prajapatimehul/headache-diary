# Cause Finder — design spec

Goal: stop the "20 years on the wrong solution" pattern. Turn the diary from a
logger into a tool that (1) widens the differential beyond the wastebasket
"migraine" label, (2) names the *specific* next test + specialist, (3) catches
the dangerous/fixable causes a rushed visit misses, and (4) hands the clinician a
triage they can't easily anchor against. Decision support — never a diagnosis.

## Why people lose decades (grounded in 5 r/migraine + r/TrueOffMyChest threads)
1. Wastebasket "migraine" label → search stops.
2. Circular dx ("migraine because migraine disease") → nobody looks for a cause.
3. Neck never examined → cervicogenic / occipital neuralgia mislabeled migraine.
4. Fixable secondary causes never imaged → sinus infection (ENT/surgery), glaucoma
   (eye drops, 25 yrs missed), dental abscess (decade).
5. Stereotype anchoring ("migraine = aura/nausea") → over- AND under-diagnosis.
6. Wrong data tracked (food/triggers, "0 correlation") instead of the ICHD-3
   discriminators; patients don't know ICHD-3 exists.
7. Only one layer treated (daily tension/cervicogenic baseline + migraine on top).
8. NDPH mistaken for chronic migraine (sudden-onset constant daily, drug-resistant).
9. Positional causes missed: worse-upright → CSF leak/SIH; worse-lying + pulsatile
   tinnitus → IIH. Hypermobility (EDS) raises CSF-leak odds.
10. Drug-ladder treadmill (4 triptans → CGRP → 50 drugs) because type was never nailed.
11. System dismissal; advocacy gap (demand referral; "document the refusal in my chart").
12. Mental-health toll (daily unexplained pain → suicidality) → validation + crisis path.

## Clinical frameworks we stand on (credible, not invented)
- SNNOOP10 secondary-headache red flags → urgent-care / imaging prompts.
- ID-Migraine (nausea+photophobia+disability), POUND → migraine likelihood.
- MIDAS / HIT-6 → disability scores doctors recognise (also good tracking).
- Cervicogenic: side-locked + neck-provoked + reduced rotation; confirmer = nerve block.
- MOH thresholds: ≥10 days/mo (triptan/opioid/combination) or ≥15 (simple analgesic), >3mo.
- Positional: worse upright → SIH/CSF leak; worse lying + pulsatile tinnitus → IIH.
- Indomethacin-responsive: paroxysmal hemicrania / hemicrania continua.
- Acute angle-closure glaucoma (eye pain + halos + red eye + nausea) = emergency.

## The candidate set the engine must consider (beyond current primaries)
Primary (have): migraine ±aura, chronic migraine, episodic/chronic TTH, cluster,
paroxysmal hemicrania, hemicrania continua, cervicogenic, MOH, NDPH.
ADD as "consider / discuss" candidates with matched-feature reasoning + action:
- Rhinogenic / sinus (ENT, CT sinuses) — congestion, post-nasal, recent URI, facial.
- Occipital neuralgia (shooting from skull base, scalp tenderness) — nerve block.
- Trigeminal neuralgia (electric-shock, trigger zones) — neuro/MRI.
- TMJ (jaw click, worse chewing/morning, bruxism) — dentist/orofacial.
- Acute angle-closure glaucoma (eye pain+halos+red eye) — EMERGENCY ophthalmology.
- IIH (worse lying/Valsalva, pulsatile tinnitus, transient visual obscurations) — neuro-ophth, LP/MRV.
- SIH / CSF leak (orthostatic: worse upright, better lying; hypermobility) — neuro, brain MRI w/ contrast.
- Hormonal/menstrual migraine (perimenstrual clustering).
- Hypnic (wakes from sleep, older age).

## New inputs to capture (small additions)
- onset clarity (sudden specific-day vs gradual) [have onset_pattern — surface it]
- positional: better lying / worse upright / worse lying / worse with Valsalva
- pulsatile tinnitus (whooshing in ear)
- jaw: clicking / worse chewing / morning jaw tightness (bruxism)
- hypermobility (can you bend thumb to forearm / very flexible)
- recent head/neck trauma; recent URI/cold; pregnancy
- prior workup tracker: bloods, brain MRI, CT sinus, eye exam/IOP, sleep study,
  nerve block, indomethacin trial, LP — done? result?
- disability (HIT-6 / MIDAS short form)

## Build plan (phased)
**Phase 1 — Cause Finder (core):**
- Engine: add the "consider" candidates with matched-feature reasoning.
- Per-candidate ACTION card: confirming test + right specialist + what to say.
- SNNOOP10 red-flag screener (onboarding + ongoing) → urgent guidance.
- MOH detector + treatment-mismatch flag ("triptans won't fix your tension/neck layer").
- Two-layer surfacing ("you likely have 2 things").
- Prior-workup tracker ("ruled out X; unchecked high-yield avenue Y").
- Export upgrade: red-flags + differential + suggested workup + flags + disability.

**Phase 2 — empowerment:** advocacy toolkit; education/myth-busting library; self-test
module (positional, neck-pressure, 20-20-20, dark-room; clinician-only tests labelled);
validation + mental-health/crisis layer.

**Phase 3 — intelligence:** pattern-change alerts, honest exacerbator correlations,
disability trends.

## Safety / ethics (non-negotiable)
- Everything framed "decision support — discuss with your clinician." Never a diagnosis.
- True emergencies (thunderclap, glaucoma, neuro deficit, papilledema, worst-ever) →
  "seek urgent care now," shown first.
- Never one definitive label; clinician-only confirmers capped at "needs test."
- Engine reads structured fields only, never free-text notes.
- Suicidality → visible crisis resources (region-aware).
