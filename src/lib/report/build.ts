// Pure, no DOM. date-fns v4. Reused by all three exporters and the print page.
import {
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  format,
  parseISO,
} from "date-fns";
import type {
  DiaryEntry,
  DateRange,
  ReportRow,
  ReportSummary,
} from "./types";

export function filterByRange(entries: DiaryEntry[], r: DateRange): DiaryEntry[] {
  if (r.kind === "all") return entries;
  let from: Date;
  let to = endOfDay(new Date());
  if (r.kind === "last7") {
    from = startOfDay(subDays(new Date(), 6));
  } else if (r.kind === "last30") {
    from = startOfDay(subDays(new Date(), 29));
  } else {
    // custom
    from = r.from ? startOfDay(parseISO(r.from)) : startOfDay(subDays(new Date(), 29));
    to = r.to ? endOfDay(parseISO(r.to)) : to;
  }
  return entries.filter((e) =>
    isWithinInterval(parseISO(e.dateISO), { start: from, end: to })
  );
}

export function buildReportRows(entries: DiaryEntry[], r: DateRange): ReportRow[] {
  return filterByRange(entries, r)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map((e) => ({
      date: e.dateISO,
      weekday: format(parseISO(e.dateISO), "EEE"),
      worst: e.worst,
      regions: e.regions.map((rp) => `${rp.region} (${rp.intensity})`).join(", "),
      durationMin: e.durationMin,
      symptoms: e.symptoms.join(", "),
      meds: e.meds.join(", "),
      note: e.note,
    }));
}

export function summarize(rows: ReportRow[]): ReportSummary {
  const hd = rows.filter((r) => r.worst > 0);
  return {
    days: rows.length,
    headacheDays: hd.length,
    avgWorst: hd.length
      ? +(hd.reduce((s, r) => s + r.worst, 0) / hd.length).toFixed(1)
      : 0,
    maxWorst: rows.reduce((m, r) => Math.max(m, r.worst), 0),
    totalMeds: rows.reduce(
      (s, r) => s + (r.meds ? r.meds.split(",").filter(Boolean).length : 0),
      0
    ),
  };
}
