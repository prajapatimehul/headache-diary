"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import type { Entry, PainMark } from "@/lib/db";
import { useEntryStore } from "@/store/entry-store";
import { cn } from "@/lib/utils";
import { SymptomChips, SymptomSegments } from "./SymptomChips";
import {
  QUALITY_OPTIONS,
  LATERALITY_OPTIONS,
  NAUSEA_OPTIONS,
  AUTONOMIC_OPTIONS,
  AURA_TYPE_OPTIONS,
  MEDS_OPTIONS,
  WHEN_OPTIONS,
  WORSE_OPTIONS,
  BETTER_OPTIONS,
  ONSET_PATTERN_OPTIONS,
  type AutonomicField,
  type AuraTypeValue,
} from "@/types/entry";

/* -------------------------------------------------------------------------- */
/* Region mapping: 3D marker regionId -> ICHD anatomical pain_regions.         */
/* CONTRACT §22. Robust to both dash (forehead-left) and underscore            */
/* (forehead_L / periorbital_L) regionId conventions so it never breaks        */
/* regardless of which the head agent ships.                                   */
/* -------------------------------------------------------------------------- */

type PainRegion =
  | "orbital"
  | "supraorbital"
  | "temporal"
  | "frontal"
  | "occipital"
  | "whole_head";

function normalizeRegionId(id: string): string {
  return id.toLowerCase().replace(/[-_]/g, " ");
}

function mapRegionId(regionId: string): PainRegion | null {
  const n = normalizeRegionId(regionId);
  if (n.includes("eye") || n.includes("periorbital") || n.includes("orbit"))
    return "orbital";
  if (n.includes("forehead")) return "frontal";
  if (n.includes("temple")) return "temporal";
  if (n.includes("occiput") || n.includes("suboccipital") || n.includes("subocciput"))
    return "occipital";
  if (n.includes("neck") || n.includes("trapezius")) return "occipital";
  if (n.includes("vertex")) return "whole_head";
  return null;
}

/** Derive `pain_regions` + distinct-region count from the tapped marks. */
export function derivePainRegions(marks: PainMark[]): string[] {
  const set = new Set<PainRegion>();
  const distinctIds = new Set<string>();
  for (const m of marks) {
    distinctIds.add(m.regionId);
    const mapped = mapRegionId(m.regionId);
    if (mapped) set.add(mapped);
  }
  // ≥4 distinct of the 17 granular regions → also flag whole_head (CONTRACT §28)
  if (distinctIds.size >= 4) set.add("whole_head");
  return [...set];
}

/* -------------------------------------------------------------------------- */
/* Small inline primitives                                                     */
/* -------------------------------------------------------------------------- */

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "border-primary bg-primary/10" : "border-border bg-secondary/50",
      )}
    >
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 36 }}
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-background shadow",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-display text-base">{title}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="space-y-4 px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EntryForm                                                                   */
/* -------------------------------------------------------------------------- */

const DURATION_PRESETS: { label: string; hours: number }[] = [
  { label: "< 1h", hours: 0.5 },
  { label: "1–4h", hours: 2 },
  { label: "4–24h", hours: 12 },
  { label: "1–3d", hours: 48 },
  { label: "> 3d", hours: 96 },
];

export function EntryForm({
  marks,
  intensity,
  onSave,
}: {
  marks: PainMark[];
  /** current pain-level from the parent slider (0-10). */
  intensity: number;
  onSave: (entry: Entry) => void | Promise<void>;
}) {
  const draft = useEntryStore((s) => s.draft);
  const settings = useEntryStore((s) => s.settings);
  const patchDraft = useEntryStore((s) => s.patchDraft);
  const resetDraft = useEntryStore((s) => s.resetDraft);

  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleAutonomic(values: AutonomicField[]) {
    const set = new Set(values);
    patchDraft({
      conjunctival_injection_or_lacrimation: set.has("conjunctival_injection_or_lacrimation"),
      nasal_congestion_or_rhinorrhoea: set.has("nasal_congestion_or_rhinorrhoea"),
      eyelid_oedema: set.has("eyelid_oedema"),
      forehead_facial_sweating: set.has("forehead_facial_sweating"),
      miosis_or_ptosis: set.has("miosis_or_ptosis"),
      restlessness_or_agitation: set.has("restlessness_or_agitation"),
    });
  }

  const selectedAutonomic: AutonomicField[] = AUTONOMIC_OPTIONS.filter(
    (o) => draft[o.value],
  ).map((o) => o.value);

  function buildEntry(): Entry {
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const pain_regions = derivePainRegions(marks);

    return {
      id: crypto.randomUUID(),
      user_id: null,
      date,

      no_headache: draft.no_headache,
      worst: draft.no_headache ? 0 : Math.max(draft.worst, intensity),
      regions: marks,

      // attack profile
      duration_hours: draft.duration_hours,
      min_duration_hours: draft.duration_hours,
      max_duration_hours: draft.duration_hours,
      laterality: draft.laterality,
      side_locked: draft.side_locked,
      quality: draft.quality,
      intensity: draft.no_headache ? 0 : intensity,
      aggravated_by_activity: draft.aggravated_by_activity,
      nausea: draft.nausea,
      vomiting: draft.vomiting,
      photophobia: draft.photophobia,
      phonophobia: draft.phonophobia,
      pain_regions,

      // aura
      aura: draft.aura,
      aura_types: draft.aura_types,
      aura_fully_reversible: draft.aura_fully_reversible,
      aura_spreads_over_5min: draft.aura_spreads_over_5min,
      aura_symptoms_in_succession: draft.aura_symptoms_in_succession,
      aura_each_5to60min: draft.aura_each_5to60min,
      aura_at_least_one_unilateral: draft.aura_at_least_one_unilateral,
      aura_at_least_one_positive: draft.aura_at_least_one_positive,
      aura_followed_by_headache_60min: draft.aura_followed_by_headache_60min,

      // autonomic
      conjunctival_injection_or_lacrimation: draft.conjunctival_injection_or_lacrimation,
      nasal_congestion_or_rhinorrhoea: draft.nasal_congestion_or_rhinorrhoea,
      eyelid_oedema: draft.eyelid_oedema,
      forehead_facial_sweating: draft.forehead_facial_sweating,
      miosis_or_ptosis: draft.miosis_or_ptosis,
      restlessness_or_agitation: draft.restlessness_or_agitation,

      // cervicogenic
      neck_range_of_motion_reduced: draft.neck_range_of_motion_reduced,
      headache_worsened_by_neck_manoeuvres: draft.headache_worsened_by_neck_manoeuvres,

      // aggregates (snapshot — derived from full history at report time;
      // per-entry defaults here, aggregate.ts recomputes for the engine)
      distinct_attack_count: 0,
      headache_days_per_month: 0,
      migrainous_days_per_month: 0,
      observation_months: 0,
      attack_frequency_per_day: 0,
      bout_pattern: "unknown",
      onset_pattern: draft.onset_pattern,

      // medication overuse (med_class etc. carried from persisted settings)
      acute_med_days_per_month: 0,
      med_class: settings.med_class,
      pre_existing_primary_headache: settings.pre_existing_primary_headache,
      meds: draft.meds,
      meds_other: draft.meds_other,

      // clinical tests — NEVER inferred; default not_tested/false
      indomethacin_response: settings.indomethacin_response,
      cervical_imaging_or_clinical_evidence: settings.cervical_imaging_or_clinical_evidence,
      nerve_block_abolishes_headache: settings.nerve_block_abolishes_headache,

      better_accounted_by_other_dx: settings.better_accounted_by_other_dx,
      note: draft.note,

      created_at: now,
      updated_at: now,
      _dirty: 1,
    };
  }

  function handleSave() {
    const entry = buildEntry();
    startTransition(async () => {
      await onSave(entry);
      resetDraft();
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="space-y-4"
    >
      <Toggle
        checked={draft.no_headache}
        onChange={(v) => patchDraft({ no_headache: v })}
        label="No headache today"
        hint="Logging pain-free days makes the report accurate"
      />

      <AnimatePresence initial={false}>
        {!draft.no_headache && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Quick log — most common fields, open by default */}
            <div className="space-y-4 rounded-2xl border border-border bg-card/50 p-4">
              <SymptomSegments
                label="How does it feel?"
                options={QUALITY_OPTIONS}
                value={draft.quality}
                onChange={(v) => patchDraft({ quality: v })}
                allowDeselect
              />
              <SymptomSegments
                label="Where?"
                options={LATERALITY_OPTIONS}
                value={draft.laterality}
                onChange={(v) => patchDraft({ laterality: v })}
                allowDeselect
              />

              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  How long does it last?
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((d) => {
                    const on = draft.duration_hours === d.hours;
                    return (
                      <button
                        key={d.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          patchDraft({ duration_hours: on ? undefined : d.hours })
                        }
                        className={cn(
                          "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Toggle
                checked={draft.aggravated_by_activity}
                onChange={(v) => patchDraft({ aggravated_by_activity: v })}
                label="Worse with movement"
                hint="walking, climbing stairs"
              />
            </div>

            {/* Other symptoms */}
            <Section title="Other symptoms" defaultOpen>
              <SymptomSegments
                label="Nausea"
                options={NAUSEA_OPTIONS}
                value={draft.nausea}
                onChange={(v) => patchDraft({ nausea: v ?? "none" })}
              />
              <div className="grid grid-cols-1 gap-2">
                <Toggle
                  checked={draft.vomiting}
                  onChange={(v) => patchDraft({ vomiting: v })}
                  label="Vomiting"
                />
                <Toggle
                  checked={draft.photophobia}
                  onChange={(v) => patchDraft({ photophobia: v })}
                  label="Light bothers me"
                />
                <Toggle
                  checked={draft.phonophobia}
                  onChange={(v) => patchDraft({ phonophobia: v })}
                  label="Sound bothers me"
                />
              </div>
            </Section>

            {/* Context (UX chips) */}
            <Section title="When & what changed it">
              <SymptomChips
                label="When"
                options={WHEN_OPTIONS}
                value={draft.when}
                onChange={(v) => patchDraft({ when: v })}
              />
              <SymptomChips
                label="Made it worse"
                options={WORSE_OPTIONS}
                value={draft.worse}
                onChange={(v) => patchDraft({ worse: v })}
              />
              <SymptomChips
                label="Made it better"
                options={BETTER_OPTIONS}
                value={draft.better}
                onChange={(v) => patchDraft({ better: v })}
              />
            </Section>

            {/* Aura */}
            <Section title="Aura (warning signs before pain)">
              <Toggle
                checked={draft.aura}
                onChange={(v) => patchDraft({ aura: v })}
                label="I had aura"
                hint="visual, tingling, speech changes before the headache"
              />
              <AnimatePresence initial={false}>
                {draft.aura && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.26 }}
                    className="space-y-3"
                  >
                    <SymptomChips
                      label="Type of aura"
                      options={AURA_TYPE_OPTIONS}
                      value={draft.aura_types as AuraTypeValue[]}
                      onChange={(v) => patchDraft({ aura_types: v })}
                    />
                    <Toggle
                      checked={draft.aura_fully_reversible}
                      onChange={(v) => patchDraft({ aura_fully_reversible: v })}
                      label="Fully went away after"
                    />
                    <Toggle
                      checked={draft.aura_spreads_over_5min}
                      onChange={(v) => patchDraft({ aura_spreads_over_5min: v })}
                      label="Spread gradually over 5+ min"
                    />
                    <Toggle
                      checked={draft.aura_each_5to60min}
                      onChange={(v) => patchDraft({ aura_each_5to60min: v })}
                      label="Each symptom lasted 5–60 min"
                    />
                    <Toggle
                      checked={draft.aura_at_least_one_unilateral}
                      onChange={(v) => patchDraft({ aura_at_least_one_unilateral: v })}
                      label="On one side"
                    />
                    <Toggle
                      checked={draft.aura_at_least_one_positive}
                      onChange={(v) => patchDraft({ aura_at_least_one_positive: v })}
                      label="Positive symptom"
                      hint="flashing lights / pins-and-needles"
                    />
                    <Toggle
                      checked={draft.aura_symptoms_in_succession}
                      onChange={(v) => patchDraft({ aura_symptoms_in_succession: v })}
                      label="Symptoms came one after another"
                    />
                    <Toggle
                      checked={draft.aura_followed_by_headache_60min}
                      onChange={(v) =>
                        patchDraft({ aura_followed_by_headache_60min: v })
                      }
                      label="Headache started within 60 min"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            {/* Autonomic / TAC */}
            <Section title="Eye & nose signs (same side as pain)">
              <SymptomChips
                aria-label="Autonomic signs"
                options={AUTONOMIC_OPTIONS}
                value={selectedAutonomic}
                onChange={toggleAutonomic}
              />
            </Section>

            {/* Neck */}
            <Section title="Neck">
              <Toggle
                checked={draft.side_locked}
                onChange={(v) => patchDraft({ side_locked: v })}
                label="Always the same side"
              />
              <Toggle
                checked={draft.neck_range_of_motion_reduced}
                onChange={(v) => patchDraft({ neck_range_of_motion_reduced: v })}
                label="Neck feels stiff / limited"
              />
              <Toggle
                checked={draft.headache_worsened_by_neck_manoeuvres}
                onChange={(v) =>
                  patchDraft({ headache_worsened_by_neck_manoeuvres: v })
                }
                label="Neck movement makes it worse"
              />
            </Section>

            {/* Onset (NDPH deciding field) */}
            <Section title="How it started">
              <SymptomSegments
                options={ONSET_PATTERN_OPTIONS}
                value={draft.onset_pattern}
                onChange={(v) => patchDraft({ onset_pattern: v ?? "unknown" })}
              />
            </Section>

            {/* Meds */}
            <Section title="Medication taken">
              <SymptomChips
                options={MEDS_OPTIONS}
                value={draft.meds}
                onChange={(v) => patchDraft({ meds: v })}
              />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted-foreground">
                  Other medication
                </span>
                <input
                  type="text"
                  value={draft.meds_other ?? ""}
                  onChange={(e) =>
                    patchDraft({ meds_other: e.target.value || undefined })
                  }
                  placeholder="any name / language"
                  className="h-11 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note — any language */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted-foreground">
          Note
        </span>
        <textarea
          value={draft.note ?? ""}
          onChange={(e) => patchDraft({ note: e.target.value || undefined })}
          rows={3}
          placeholder="कुछ भी लिखें — anything, any language"
          className="w-full resize-y rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <motion.button
        type="submit"
        disabled={pending}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold",
          "bg-primary text-primary-foreground shadow-lg transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-60",
        )}
      >
        {saved ? (
          <>
            <Check className="size-5" /> Saved
          </>
        ) : pending ? (
          "Saving…"
        ) : (
          "Save today's entry"
        )}
      </motion.button>
    </form>
  );
}
