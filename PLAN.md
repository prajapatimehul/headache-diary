# Headache Diary — Product Spec & Build Plan

A mobile-first PWA that lets anyone map their headache on a 3D head, log it daily in any language, and walk into a doctor with a **diary + an ICHD-3 criteria analysis** that points at the likely headache type.

## Who & why
- People with recurring/undiagnosed headaches who want to *find the exact issue* with their doctor.
- Doctors get structured, longitudinal data mapped to the official **ICHD-3 (2018)** classification instead of vague recall.

## Principles
- **Local-first**: works fully offline; cloud sync is optional. Your data is yours.
- **Honest**: the app never "diagnoses." It maps logged data to ICHD-3 criteria and flags what only a clinician can confirm (e.g. indomethacin trial, nerve block).
- **Calm**: usable while in pain (see DESIGN.md).

## Feature set
1. **Daily log** — fast, one-thumb. Pick the day; mark "no headache" or log it.
2. **3D head map** — rotate, tap to place pain markers; intensity 0–10 (heat). Maps each tap to the nearest of ~16 regions.
3. **Symptom capture** (also the ICHD-3 inputs, see below).
4. **Notes in any language** — Hinglish / English / Devanagari free text, preserved in exports.
5. **Progressive insight** — provisional ICHD-3 read that strengthens with data:
   - Days 1–4: "keep logging."
   - Day 5+: preliminary top candidates (low confidence) + what's needed to separate them.
   - Day 30+: strong provisional classification, criterion-by-criterion, with 3-month / clinical-test caveats.
   - Education: how many headache types ICHD-3 recognizes & where yours points.
6. **ICHD-3 export** — doctor-ready PDF (renders any language) + CSV + JSON, with date range (7 / 30 / all / custom). The PDF includes the per-day diary **and** the ICHD-3 criteria analysis.
7. **Multi-user cloud sync** — Supabase auth (magic link) + Postgres + RLS; each user sees only their own rows. Syncs across devices.
8. **PWA** — installable, offline, standalone.

## Diary field set (daily) — also the ICHD-3 engine inputs
- **date**, **no_headache** (bool)
- **regions**: `{regionId: intensity 0–10}` (from 3D head)
- **worst intensity** (derived) + intensity band (mild ≤3 / moderate 4–6 / severe ≥7)
- **duration** band: <4h · 4–72h · >72h/days · continuous (ICHD-3 needs this)
- **side**: unilateral / bilateral / side-locked (derived from regions + a toggle)
- **quality**: pressing/tight · throbbing/pulsating · stabbing · pulling · burning · pressure-behind-eye
- **aggravated by routine physical activity** (yes/no) — migraine vs TTH discriminator
- **photophobia**, **phonophobia**, **nausea/vomiting** — migraine/TTH criteria
- **aura** (visual/sensory/speech, reversible) — migraine-with-aura
- **autonomic signs** (ipsilateral): conjunctival injection/lacrimation · nasal congestion/rhinorrhoea · eyelid oedema · ptosis/miosis · restlessness/agitation — TACs (cluster/PH/HC)
- **neck**: stiff on waking? · chin-to-chest? · provoked by neck movement/posture — cervicogenic
- **when**: on waking / morning / midday / afternoon / evening / night / all day
- **worse-with / better-with** triggers (light, screen, bending, cough, cold/AC, neck movement, rest, dark, painkiller, etc.)
- **meds taken** + **acute-med days/month** (derived) — medication-overuse
- **note** (free text, any language)

## ICHD-3 engine (deterministic)
Aggregates entries → computes, per diagnosis, **MET / PROBABLE / NOT MET** with the official code and each criterion's pass/fail. Covers at least:
- 1.1 Migraine without aura · 1.2 with aura · 1.3 Chronic migraine
- 2.1/2.2 Episodic TTH · 2.3 Chronic TTH
- 3.1 Cluster · 3.2 Paroxysmal hemicrania · 3.4 Hemicrania continua
- 11.2.1 Cervicogenic
- 8.2 Medication-overuse headache
- 4.10 New daily persistent headache
**Data-sufficiency gating**: each verdict states the data it needs (e.g. "needs ≥3 months", "needs ≥5 attacks", "needs an indomethacin trial — clinician only"). Confidence scales with number of logged days. Source of truth: ICHD-3 2018 (ichd-3.org).

## Architecture
- **Next.js (App Router, TS) + Tailwind v4**, mostly client-rendered app shell.
- **3D**: react-three-fiber + drei (rotatable head, raycast markers, nearest-region).
- **Store**: local-first IndexedDB (source of truth) ↔ Supabase sync on login.
- **DB/Auth**: Supabase (Postgres + RLS + magic-link). Client talks to Supabase directly under RLS — minimal backend.
- **Export**: dedicated print route + `window.print()` (renders any language) for PDF; client-side CSV/JSON.
- **PWA**: per research (Serwist or current best).
- **Deploy**: Vercel. **Repo**: GitHub (public).

## Build phases
0. Scaffold + research blueprint ✅ (in progress)
1. Core: design system, app shell, 3D head, diary store (local-first), daily logging
2. Insight: ICHD-3 engine + progressive 5-day/30-day verdict + education
3. Export: print PDF (with ICHD-3 block) + CSV/JSON + range
4. Ship: GitHub + Vercel (live PWA, local-only)
5. Multi-user: Supabase schema+RLS, auth, sync, env → redeploy
6. Polish: motion, icons, offline, a11y, final deploy
