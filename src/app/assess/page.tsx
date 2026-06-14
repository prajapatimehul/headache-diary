"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import {
  blankProfile,
  loadProfile,
  saveProfile,
  type CauseProfile,
  type TestState,
} from "@/lib/cause-finder";

const TREATMENTS: { id: string; label: string }[] = [
  { id: "triptan", label: "Triptans (sumatriptan…)" },
  { id: "cgrp", label: "CGRP / gepants (Ajovy, Ubrelvy…)" },
  { id: "amitriptyline", label: "Amitriptyline / preventive" },
  { id: "nsaid", label: "NSAIDs / painkillers" },
  { id: "botox", label: "Botox" },
  { id: "nerve_block", label: "Nerve block" },
  { id: "physio", label: "Physiotherapy / neck work" },
];

const WORKUP: { id: keyof CauseProfile["workup"]; label: string }[] = [
  { id: "brainMRI", label: "Brain MRI" },
  { id: "ctSinus", label: "CT sinuses / ENT scope" },
  { id: "eyeExamIOP", label: "Eye exam + pressure" },
  { id: "bloods", label: "Blood tests" },
  { id: "sleepStudy", label: "Sleep study" },
  { id: "cervicalImaging", label: "Neck / cervical imaging" },
  { id: "nerveBlock", label: "Diagnostic nerve block" },
  { id: "indomethacinTrial", label: "Indomethacin trial" },
  { id: "lumbarPuncture", label: "Lumbar puncture (pressure)" },
];

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm active:scale-[0.995]"
    >
      <span>{children}</span>
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full border ${
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border"
        }`}
      >
        {on && <Check className="size-4" />}
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-full border px-3 py-2 text-xs font-medium ${
            value === o.v
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

export default function AssessPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [p, setP] = useState<CauseProfile>(() =>
    typeof window === "undefined" ? blankProfile() : loadProfile(),
  );
  const [saved, setSaved] = useState(false);

  const set = (patch: Partial<CauseProfile>) =>
    setP((prev) => ({ ...prev, ...patch }));
  const toggleTreatment = (id: string) =>
    set({
      treatmentsTried: p.treatmentsTried.includes(id)
        ? p.treatmentsTried.filter((t) => t !== id)
        : [...p.treatmentsTried, id],
    });
  const setWorkup = (id: keyof CauseProfile["workup"], v: TestState) =>
    set({ workup: { ...p.workup, [id]: v } });

  function save() {
    saveProfile(p);
    setSaved(true);
    setTimeout(() => router.push("/causes"), 600);
  }

  const enter = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-28 pt-6">
      <motion.header {...enter}>
        <h1 className="font-display text-3xl">Find your cause</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A few questions a rushed appointment skips. They make the cause search
          and the red-flag safety check much sharper. All optional.
        </p>
      </motion.header>

      <Field label="When you're upright vs lying down">
        <Segmented
          value={p.positional}
          onChange={(v) => set({ positional: v })}
          options={[
            { v: "none", label: "No difference" },
            { v: "worse_upright", label: "Worse upright" },
            { v: "worse_lying", label: "Worse lying" },
            { v: "worse_valsalva", label: "Worse straining/cough" },
            { v: "unknown", label: "Not sure" },
          ]}
        />
      </Field>

      <Field label="Eyes & ears">
        <div className="space-y-2">
          <Toggle on={p.pulsatileTinnitus} onClick={() => set({ pulsatileTinnitus: !p.pulsatileTinnitus })}>
            Whooshing / pulsing sound in the ear
          </Toggle>
          <Toggle on={p.transientVisualObscurations} onClick={() => set({ transientVisualObscurations: !p.transientVisualObscurations })}>
            Brief greying / blacking out of vision
          </Toggle>
          <Toggle on={p.eyeRednessHalos} onClick={() => set({ eyeRednessHalos: !p.eyeRednessHalos })}>
            Red, painful eye with halos around lights
          </Toggle>
          <Toggle on={p.visionLossOrField} onClick={() => set({ visionLossOrField: !p.visionLossOrField })}>
            Lasting vision loss / blind spot
          </Toggle>
        </div>
      </Field>

      <Field label="Jaw & teeth">
        <div className="space-y-2">
          <Toggle on={p.jawClickOrPainChewing} onClick={() => set({ jawClickOrPainChewing: !p.jawClickOrPainChewing })}>
            Jaw clicks or hurts when chewing
          </Toggle>
          <Toggle on={p.bruxism} onClick={() => set({ bruxism: !p.bruxism })}>
            Teeth grinding / tight jaw in the morning
          </Toggle>
        </div>
      </Field>

      <Field label="Nose & sinuses">
        <Toggle on={p.facialPressureCongestion} onClick={() => set({ facialPressureCongestion: !p.facialPressureCongestion })}>
          Facial pressure / blocked nose with the pain
        </Toggle>
      </Field>

      <Field label="Body & history">
        <div className="space-y-2">
          <Toggle on={p.hypermobile} onClick={() => set({ hypermobile: !p.hypermobile })}>
            Very flexible / double-jointed (hypermobile)
          </Toggle>
          <Toggle on={p.recentHeadNeckTrauma} onClick={() => set({ recentHeadNeckTrauma: !p.recentHeadNeckTrauma })}>
            Recent head or neck injury
          </Toggle>
          <Toggle on={p.recentRespiratoryInfection} onClick={() => set({ recentRespiratoryInfection: !p.recentRespiratoryInfection })}>
            Recent cold / respiratory infection
          </Toggle>
          <Toggle on={p.newOnsetOver50} onClick={() => set({ newOnsetOver50: !p.newOnsetOver50 })}>
            New headache that started after age 50
          </Toggle>
          <Toggle on={p.pregnant} onClick={() => set({ pregnant: !p.pregnant })}>
            Pregnant or recently gave birth
          </Toggle>
        </div>
      </Field>

      <Field label="Safety check (tell a doctor if any are true)">
        <div className="space-y-2">
          <Toggle on={p.thunderclapEver} onClick={() => set({ thunderclapEver: !p.thunderclapEver })}>
            A headache hit max intensity in under a minute
          </Toggle>
          <Toggle on={p.neuroDeficit} onClick={() => set({ neuroDeficit: !p.neuroDeficit })}>
            Weakness, numbness, slurred speech, or confusion
          </Toggle>
          <Toggle on={p.feverOrSystemic} onClick={() => set({ feverOrSystemic: !p.feverOrSystemic })}>
            Fever / stiff neck / unexplained weight loss
          </Toggle>
          <Toggle on={p.cancerHistory} onClick={() => set({ cancerHistory: !p.cancerHistory })}>
            History of cancer
          </Toggle>
          <Toggle on={p.immuneCompromise} onClick={() => set({ immuneCompromise: !p.immuneCompromise })}>
            Weakened immune system (HIV, immunosuppressants)
          </Toggle>
        </div>
      </Field>

      <Field label="Treatments you've already tried">
        <div className="flex flex-wrap gap-2">
          {TREATMENTS.map((t) => {
            const on = p.treatmentsTried.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTreatment(t.id)}
                className={`rounded-full border px-3 py-2 text-xs font-medium ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Tests you've already had">
        <div className="space-y-3">
          {WORKUP.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{w.label}</span>
              <Segmented
                value={p.workup[w.id]}
                onChange={(v) => setWorkup(w.id, v)}
                options={[
                  { v: "not_done", label: "No" },
                  { v: "normal", label: "Normal" },
                  { v: "abnormal", label: "Abnormal" },
                ]}
              />
            </div>
          ))}
        </div>
      </Field>

      <button
        type="button"
        onClick={save}
        className="mt-8 w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground active:scale-[0.99]"
      >
        {saved ? "Saved ✓" : "Save & see causes"}
      </button>
    </main>
  );
}
