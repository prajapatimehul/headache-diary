# BUILD CONTRACT — shared interfaces for parallel implementation

Every implementation agent MUST follow this so files compile together. `BLUEPRINT.md` is the full spec; this file is the cross-file contract. Verbatim code per area lives in `/tmp/hd-snippets/{supabase,export,head3d,ichd3,pwa}.md`.

## Hard rules
- **Project root:** `/Users/mehul/Desktop/projects/personal/headache-diary`. Use the file paths in BLUEPRINT.md §3 (everything under `src/`, alias `@/*` → `./src/*`).
- **DO NOT TOUCH:** `src/app/globals.css` (design tokens already final), `package.json` (deps already pinned), `src/app/layout.tsx` is owned ONLY by the app-shell agent.
- **Design tokens already exist** in globals.css. Use shadcn/Tailwind semantic classes mapped to our palette: `bg-background text-foreground bg-card bg-primary text-primary-foreground text-muted-foreground border-border bg-secondary bg-accent`. Headings use `font-display` (Fraunces). Body is Hanken (default). Dark is the default theme (`<html class="dark">`). Pain heat uses CSS vars `--h0`..`--h10` (helper in `src/components/head/heat.ts`).
- **UI kit:** shadcn (style *base-nova*, built on `@base-ui/react`) for primitives; add components with `npx shadcn@latest add <name>` ONLY if needed. **Animations:** use `motion` (`import { motion } from "motion/react"`). Calm, eased, `prefers-reduced-motion`-safe (see DESIGN.md).
- **Mobile-first.** Large touch targets (≥44px), thumb-reachable, safe-area aware.
- **Any-language notes:** all text inputs accept Devanagari/Hinglish (UTF-8) — no special handling, just don't restrict input.
- **3D head is PROCEDURAL — there is NO .glb asset.** Build the head from three.js geometry (a deformed sphere/parametric head + optional translucent brain). Do NOT `useGLTF`. Everything else from the head3d snippet (tap-vs-drag, local-space classify, heat markers, OrbitControls) stays.

## Canonical types (authoritative locations — import, never redefine)
- `Entry` and `PainMark` are defined in **`src/lib/db/index.ts`** (data-layer agent). Exact interface = BLUEPRINT.md §4 `src/lib/db/index.ts`. All other code imports: `import { db, type Entry, type PainMark } from "@/lib/db"`.
- ICHD-3 result types (`DxResult`, `Verdict`, `DiaryAggregate`, `AttackProfile`) are defined in **`src/lib/ichd3/model.ts`** (engine agent). Import from `@/lib/ichd3/model`. Do not redefine.
- Report types in `src/lib/report/types.ts`.

## Verdict vocabulary (engine + report must agree)
`Verdict = "MET" | "PROBABLE" | "NOT_MET" | "NEEDS_TEST"`. Each `DxResult` carries: ICHD code (e.g. `"2.3"`), human name, verdict, per-criterion `{ id, label, passed }[]`, `missing: string[]`, optional `needsTest?: string`. Indomethacin-dependent (PH 3.2, HC 3.4) and cervicogenic (11.2.1 crit B + nerve-block C4) results CAP at `NEEDS_TEST` — never auto-MET from diary data.

## Region vocabulary (two layers — keep them mapped)
1. **3D marker region ids** (granular, stored in `PainMark.regionId`, defined in `src/components/head/regions.ts`):
   `forehead-left, forehead-center, forehead-right, temple-left, temple-right, eye-left, eye-right, vertex, occiput-left, occiput-center, occiput-right, subocciput-left, subocciput-right, neck-upper-left, neck-upper-right, trapezius-left, trapezius-right`
2. **ICHD anatomical pain regions** (`Entry.pain_regions: string[]`, consumed by the engine TAC gate):
   `orbital | supraorbital | temporal | frontal | occipital | whole_head`
   **Mapping (EntryForm derives `pain_regions` from the tapped `regionId`s):**
   `eye-* → orbital`; `forehead-* → frontal`; `temple-* → temporal`; `occiput-*/subocciput-* → occipital`; `vertex → whole_head`; `neck-*/trapezius-* → occipital`. (≥4 distinct of the 17 → also add `whole_head`.)

## Diary field set
The full canonical field list is BLUEPRINT.md §6 and maps 1:1 to the `Entry` interface (snake_case) and the SQL columns (§5). The `EntryForm` binds these, defaulting clinical-test fields to `not_tested`/`false`, stamping `id=crypto.randomUUID()`, `created_at`/`updated_at`, and `_dirty=1` via `saveEntry`. Symptom option lists live in `src/types/entry.ts`.

## Progressive insight (5-day / 30-day feature)
`src/lib/ichd3/engine.ts` also exports `progressiveInsight(entries: Entry[])` returning:
`{ daysLogged, stage: "warmup" | "preliminary" | "strong", confidence: 0..1, topCandidates: DxResult[], needed: string[], caveats: string[] }`.
- `daysLogged < 5` → stage `warmup`, message "keep logging".
- `5 ≤ daysLogged < 30` → `preliminary`: top 2-3 candidates, low confidence, `needed` = what separates them.
- `daysLogged ≥ 30` → `strong`: full classify(), but include caveats for any dx needing ≥3 months (CTTH/CM/MOH) or a clinical test (HC/PH/cervicogenic). Never overstate.
The Insight page renders this; the print report includes the strong-stage analysis.

## Imports / conventions
- `"use client"` on every component using hooks, three.js, Dexie live queries, or browser APIs.
- `<HeadScene>` is imported via `next/dynamic({ ssr:false })` (three.js must not SSR).
- Dexie live data via `useLiveQuery` from `dexie-react-hooks`.
- Never read `Entry.note` in the engine (free text is UX only).
- Always render the decision-support disclaimer near any ICHD-3 verdict: *"Decision support, not a diagnosis. Confirm with a clinician."*
