// Single source of truth for the report layer.
// Every exporter (CSV / JSON / print) consumes ReportRow so the outputs can never disagree.

export interface RegionPain {
  region: string;
  intensity: number; // 0-10
}

export interface DiaryEntry {
  id: string;
  dateISO: string; // '2026-06-13'
  worst: number; // 0-10
  regions: RegionPain[];
  durationMin: number; // minutes
  symptoms: string[]; // e.g. ['nausea','photophobia']
  meds: string[]; // e.g. ['Sumatriptan 50mg']
  note: string; // ANY language / script
}

export type RangeKind = "last7" | "last30" | "all" | "custom";

export interface DateRange {
  kind: RangeKind;
  from?: string; // ISO date 'YYYY-MM-DD'
  to?: string; // ISO date 'YYYY-MM-DD'
}

// Flat row used identically by print table, CSV and JSON.
export interface ReportRow {
  date: string;
  weekday: string;
  worst: number;
  regions: string; // 'Right temple (8), Forehead (5)'
  durationMin: number;
  symptoms: string;
  meds: string;
  note: string;
}

export interface ReportSummary {
  days: number;
  headacheDays: number;
  avgWorst: number;
  maxWorst: number;
  totalMeds: number;
}
