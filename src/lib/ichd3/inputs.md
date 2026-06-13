# ICHD-3 input fields → criterion map

The diary captures a **per-attack profile** plus **monthly/course aggregates**; the engine
derives a `DiaryAggregate` from the stored `Entry[]` history (see `aggregate.ts`) and runs
the 10 dx functions in `engine.ts`. Field numbers map 1:1 to ICHD-3 criterion sub-clauses.

**Day-threshold split for MOH (8.2):** simple / non-opioid analgesics gate at **≥15 days/month**;
ergotamine / triptan / opioid / combination / multiple gate at **≥10 days/month**
(verified ichd-3.org 8.2.1–8.2.6). A flat 15-day rule under-diagnoses triptan/opioid MOH.

> The engine reads **only structured fields**. It never reads `Entry.note` (free text, any
> language — Hinglish/Devanagari). A note can never silently change a verdict.

---

## A. Attack-level fields (`AttackProfile`)

| # | Field (`AttackProfile`) | Type | ICHD-3 criterion use |
|---|---|---|---|
| 1 | `typicalDurationHours` | number | Cluster 3.1 B (15–180 min), PH 3.2 B (2–30 min) — the modal attack length |
| 2 | `minDurationHours` | number | MwoA 1.1 B (≥4h), TTH 2.x B (≥30 min) — shortest qualifying attack |
| 3 | `maxDurationHours` | number | MwoA 1.1 B (≤72h), TTH 2.x B (≤7 days) — longest qualifying attack |
| 4 | `laterality` | `unilateral`\|`bilateral` | MwoA C, TTH C (bilateral), cluster/PH/HC (unilateral) |
| 5 | `sideLocked` | boolean | Cervicogenic / TAC signal (surfaced in 11.2.1 crit C reason) |
| 6 | `quality` | `pulsating`\|`pressing_tightening`\|`stabbing`\|`other` | MwoA C (pulsating), TTH C (pressing) |
| 7 | `intensity0to10` | 0–10 int | MwoA C (≥4 mod/sev), TTH C (mild/mod), cluster/PH B (≥7 severe) |
| 8 | `aggravatedByRoutineActivity` | boolean | MwoA C (true), TTH C (false/not aggravated) |
| 9 | `nausea` | `none`\|`mild`\|`moderate`\|`severe` | MwoA D; TTH D (episodic forbids any; chronic forbids mod/severe) |
| 10 | `vomiting` | boolean | MwoA D, TTH D |
| 11 | `photophobia` | boolean | MwoA D (photo+phono), TTH D |
| 12 | `phonophobia` | boolean | MwoA D (photo+phono), TTH D |
| 13 | `painRegions` | `PainRegion[]` | Cluster/PH B — TAC region gate (`orbital`/`supraorbital`/`temporal`) |

### Aura (1.2)
| # | Field | ICHD-3 criterion use |
|---|---|---|
| 14 | `auraPresent` | MwA A / B prerequisite |
| 15 | `auraTypes[]` | MwA B (≥1 fully reversible aura symptom type) |
| 16 | `auraFullyReversible` | MwA B |
| 17 | `auraSpreadsOver5min` | MwA C (1 of 6) |
| 18 | `auraSymptomsInSuccession` | MwA C (2 of 6) |
| 19 | `auraEachSymptom5to60min` | MwA C (3 of 6) |
| 20 | `auraAtLeastOneUnilateral` | MwA C (4 of 6) |
| 21 | `auraAtLeastOnePositive` | MwA C (5 of 6) — scintillations / pins-and-needles |
| 22 | `auraFollowedByHeadacheWithin60min` | MwA C (6 of 6) |

> MwA crit C = **≥3 of 6**; crit A needs only **≥2 attacks** (not 5 like MwoA).

### Autonomic / TAC (3.1 / 3.2 / 3.4), ipsilateral
| # | Field | ICHD-3 criterion use |
|---|---|---|
| 23 | `conjunctivalInjectionOrLacrimation` | Cluster/PH/HC C (≥1 autonomic sign) |
| 24 | `nasalCongestionOrRhinorrhoea` | Cluster/PH/HC C |
| 25 | `eyelidOedema` | Cluster/PH/HC C |
| 26 | `foreheadFacialSweating` | Cluster/PH/HC C |
| 27 | `miosisOrPtosis` | Cluster/PH/HC C |
| 28 | `restlessnessOrAgitation` | Cluster/PH C (alternative to autonomic sign) |

### Cervicogenic provocation (11.2.1)
| # | Field | ICHD-3 criterion use |
|---|---|---|
| 29 | `neckRangeOfMotionReduced` | 11.2.1 crit C item 3 (diary-derivable, with #30) |
| 30 | `headacheWorsenedByNeckManoeuvres` | 11.2.1 crit C item 3 |

---

## B. Monthly / course aggregates (`DiaryAggregate`)

| # | Field | ICHD-3 criterion use |
|---|---|---|
| 31 | `distinctAttackCount` | A-criterion attack minimums: ≥5 MwoA/cluster, ≥2 MwA, ≥20 PH, ≥10 TTH |
| 32 | `headacheDaysPerMonth` | CM 1.3 A (≥15), CTTH 2.3, MOH 8.2 A (≥15), HC 3.4 B |
| 33 | `migrainousDaysPerMonth` | CM 1.3 C (≥8) |
| 34 | `observationMonths` | every ">3 months" clause (CM, CTTH, MOH, HC, NDPH) |
| 35 | `attackFrequencyPerDay` | Cluster 3.1 D (0.5–8/day), PH 3.2 D (>5/day) |
| 36 | `boutPattern` | episodic vs chronic context (remission ≥3mo → episodic) |
| 37 | `onsetPattern` | **NDPH 4.10 B** — the deciding field (`daily_unremitting_from_onset_within_24h`) |

### Medication overuse (8.2)
| # | Field | ICHD-3 criterion use |
|---|---|---|
| 38 | `acuteMedDaysPerMonth` | MOH 8.2 B (≥ threshold) |
| 39 | `medClass` | MOH threshold selector + sub-code (8.2.1–8.2.6) |
| 40 | `preExistingPrimaryHeadache` | MOH 8.2 A |

### Clinical-test inputs — NEVER inferred from diary (default → NEEDS_TEST)
| # | Field | Default | ICHD-3 criterion use |
|---|---|---|---|
| 41 | `indomethacinResponse` | `not_tested` | **PH 3.2 crit E**, **HC 3.4 crit D** — caps at NEEDS_TEST |
| 42 | `cervicalImagingOrClinicalEvidence` | `false` | **Cervicogenic 11.2.1 crit B** — caps at NEEDS_TEST |
| 43 | `nerveBlockAbolishesHeadache` | `not_tested` | **Cervicogenic 11.2.1 crit C item 4** — caps at NEEDS_TEST |

### Exclusion (clinician-set)
| # | Field | Default | ICHD-3 criterion use |
|---|---|---|---|
| 44 | `betterAccountedByOtherDx` | `false` | Every primary-headache final criterion ("not better accounted for by another ICHD-3 dx") |

---

## Verdicts (`Verdict`)

- **MET** — every required criterion (incl. attack-count minimum) passes.
- **PROBABLE** — the precise ICHD **1.5 / 2.4 / 3.5** pattern: attack-count shortfall, or
  exactly one other criterion unmet. Deterministic, **not** fuzzy uncertainty.
- **NOT_MET** — core criteria fail.
- **NEEDS_TEST** — diary data alone cannot satisfy a clinical-test criterion. Hard-gated:
  - **3.2 Paroxysmal hemicrania** crit E (indomethacin)
  - **3.4 Hemicrania continua** crit D (indomethacin)
  - **11.2.1 Cervicogenic** crit B (imaging/clinical) + crit C item 4 (nerve block)

## Hierarchy post-pass (`classify()`)

- **CM (1.3) suppresses CTTH (2.3)** — tension-type-like days fall inside CM criteria.
- **CM + MOH (8.2.x) are reported TOGETHER** — both codes, never one over the other.
- **NDPH (4.10) takes precedence** over CM/CTTH when onset is daily-and-unremitting within
  24h of a clearly-remembered onset.

## Disclaimer (required wherever a verdict is shown)

> Decision support, not a diagnosis. Confirm with a clinician.

This is a deterministic aggregation of published ICHD-3 criteria. Several diagnoses are
explicitly gated as "needs test"; the engine assumes no competing diagnosis unless a
clinician sets `betterAccountedByOtherDx`.
