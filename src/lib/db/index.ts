import Dexie, { type Table } from "dexie";

/**
 * Local-first source of truth (IndexedDB via Dexie).
 *
 * This file OWNS the canonical `Entry` and `PainMark` types — every other module
 * imports them from here (`import { db, type Entry, type PainMark } from "@/lib/db"`)
 * and must never redefine them. The shape mirrors BLUEPRINT §6 (the field set),
 * §5 (the SQL columns, snake_case), and the ICHD-3 `DiaryAggregate` 1:1.
 *
 * Dexie is chosen over idb/idb-keyval because sync needs INDEXED queries
 * (`where("_dirty").equals(1)`, ordering by `updated_at`). Index booleans as
 * 0/1 — IndexedDB cannot index `true`/`false`. Generate `id` client-side with
 * `crypto.randomUUID()` so local and remote share the primary key and upserts
 * are deterministic.
 */

/** One pain mark per tap on the 3D head. Stored inside `Entry.regions`. */
export interface PainMark {
  id: string;
  regionId: string;
  regionLabel: string;
  intensity: number;
  color: string;
  local: [number, number, number];
  world: [number, number, number];
  ts: number;
}

export interface Entry {
  id: string;
  user_id: string | null;
  date: string; // YYYY-MM-DD
  no_headache: boolean;
  worst: number; // 0-10
  regions: PainMark[];

  // attack profile
  duration_hours?: number;
  min_duration_hours?: number;
  max_duration_hours?: number;
  laterality?: "unilateral" | "bilateral";
  side_locked: boolean;
  quality?: "pulsating" | "pressing_tightening" | "stabbing" | "other";
  intensity?: number;
  aggravated_by_activity: boolean;
  nausea: "none" | "mild" | "moderate" | "severe";
  vomiting: boolean;
  photophobia: boolean;
  phonophobia: boolean;
  pain_regions: string[];

  // aura
  aura: boolean;
  aura_types: string[];
  aura_fully_reversible: boolean;
  aura_spreads_over_5min: boolean;
  aura_symptoms_in_succession: boolean;
  aura_each_5to60min: boolean;
  aura_at_least_one_unilateral: boolean;
  aura_at_least_one_positive: boolean;
  aura_followed_by_headache_60min: boolean;

  // autonomic
  conjunctival_injection_or_lacrimation: boolean;
  nasal_congestion_or_rhinorrhoea: boolean;
  eyelid_oedema: boolean;
  forehead_facial_sweating: boolean;
  miosis_or_ptosis: boolean;
  restlessness_or_agitation: boolean;

  // cervicogenic
  neck_range_of_motion_reduced: boolean;
  headache_worsened_by_neck_manoeuvres: boolean;

  // aggregates (snapshot)
  distinct_attack_count: number;
  headache_days_per_month: number;
  migrainous_days_per_month: number;
  observation_months: number;
  attack_frequency_per_day: number;
  bout_pattern: "episodic" | "chronic" | "unknown";
  onset_pattern:
    | "daily_unremitting_from_onset_within_24h"
    | "gradual"
    | "unknown";

  // medication overuse
  acute_med_days_per_month: number;
  med_class:
    | "ergotamine"
    | "triptan"
    | "opioid"
    | "combination_analgesic"
    | "simple_nonopioid"
    | "multiple_not_individually"
    | "none";
  pre_existing_primary_headache: boolean;
  meds: string[];
  meds_other?: string;

  // clinical tests
  indomethacin_response: "absolute" | "partial" | "none" | "not_tested";
  cervical_imaging_or_clinical_evidence: boolean;
  nerve_block_abolishes_headache: "yes" | "no" | "not_tested";

  better_accounted_by_other_dx: boolean;
  note?: string;

  created_at: string;
  updated_at: string;
  _dirty?: 0 | 1;
}

export class DiaryDB extends Dexie {
  entries!: Table<Entry, string>;

  constructor() {
    super("headache-diary");
    // pk = id; indexes on date, updated_at, _dirty for sync queries.
    this.version(1).stores({
      entries: "id, date, updated_at, _dirty",
    });
  }
}

export const db = new DiaryDB();

/* ------------------------------------------------------------------ */
/* Helpers consumed by the report pages (BLUEPRINT §7 reconciliation). */
/* ------------------------------------------------------------------ */

/** All entries, oldest-stored first. */
export function loadEntries(): Promise<Entry[]> {
  return db.entries.toArray();
}

const RANGE_KEY = "hd:report-range";

export interface StoredRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

/** Persisted report date range (localStorage; client only). */
export function loadRange(): StoredRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RANGE_KEY);
    return raw ? (JSON.parse(raw) as StoredRange) : null;
  } catch {
    return null;
  }
}

export function saveRange(range: StoredRange): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RANGE_KEY, JSON.stringify(range));
  } catch {
    // storage unavailable (private mode / quota) — non-fatal.
  }
}
