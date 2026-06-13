// Client-only download helpers. The '﻿' BOM prefix is the single most important
// line for Hindi-in-Excel. Papa.unparse with quotes:true keeps notes containing
// commas / quotes / newlines intact.
import Papa from "papaparse";
import type { ReportRow } from "./types";

// Native anchor download — no file-saver dependency.
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so Firefox doesn't truncate the download (esp. larger files).
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadCSV(rows: ReportRow[], filename = "headache-diary.csv") {
  const csv = Papa.unparse(rows, { quotes: true, header: true });
  // U+FEFF BOM => Excel (Win/Mac) detects UTF-8 and renders Devanagari/Hinglish correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function downloadJSON(rows: ReportRow[], filename = "headache-diary.json") {
  // Already UTF-8; do NOT add a BOM — some strict JSON parsers reject a leading BOM.
  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  triggerDownload(blob, filename);
}
