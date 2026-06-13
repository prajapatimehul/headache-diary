// Adapts the canonical Dexie `Entry` (snake_case, full ICHD-3 field set) into the
// flat report-layer `DiaryEntry`. Keeping this in one place means the CSV / JSON /
// print outputs all derive from an identical projection of the stored data.
import type { Entry } from "@/lib/db";
import type { DiaryEntry, RegionPain } from "./types";

const SYMPTOM_FLAGS: Array<{ key: keyof Entry; label: string }> = [
  { key: "photophobia", label: "photophobia" },
  { key: "phonophobia", label: "phonophobia" },
  { key: "vomiting", label: "vomiting" },
  { key: "aura", label: "aura" },
  { key: "aggravated_by_activity", label: "aggravated by activity" },
  { key: "restlessness_or_agitation", label: "restlessness/agitation" },
  { key: "conjunctival_injection_or_lacrimation", label: "lacrimation" },
  { key: "nasal_congestion_or_rhinorrhoea", label: "nasal congestion" },
  { key: "eyelid_oedema", label: "eyelid oedema" },
  { key: "forehead_facial_sweating", label: "facial sweating" },
  { key: "miosis_or_ptosis", label: "miosis/ptosis" },
];

function symptomsOf(e: Entry): string[] {
  const out: string[] = [];
  if (e.nausea && e.nausea !== "none") out.push(`nausea (${e.nausea})`);
  for (const { key, label } of SYMPTOM_FLAGS) {
    if (e[key]) out.push(label);
  }
  return out;
}

function medsOf(e: Entry): string[] {
  const out = [...(e.meds ?? [])];
  if (e.meds_other && e.meds_other.trim()) out.push(e.meds_other.trim());
  return out;
}

function regionsOf(e: Entry): RegionPain[] {
  // One mark per tap on the 3D head; group by human label, keep the worst intensity.
  const byLabel = new Map<string, number>();
  for (const m of e.regions ?? []) {
    const label = m.regionLabel || m.regionId;
    const prev = byLabel.get(label) ?? 0;
    byLabel.set(label, Math.max(prev, m.intensity));
  }
  return [...byLabel.entries()]
    .map(([region, intensity]) => ({ region, intensity }))
    .sort((a, b) => b.intensity - a.intensity);
}

export function entryToDiaryEntry(e: Entry): DiaryEntry {
  const durationMin =
    typeof e.duration_hours === "number" ? Math.round(e.duration_hours * 60) : 0;
  return {
    id: e.id,
    dateISO: e.date,
    worst: e.no_headache ? 0 : e.worst,
    regions: regionsOf(e),
    durationMin,
    symptoms: e.no_headache ? [] : symptomsOf(e),
    meds: medsOf(e),
    note: e.note ?? "",
  };
}

export function entriesToDiaryEntries(entries: Entry[]): DiaryEntry[] {
  return entries.map(entryToDiaryEntry);
}
