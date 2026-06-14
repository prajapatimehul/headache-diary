"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildReportRows, summarize } from "@/lib/report/build";
import { entriesToDiaryEntries } from "@/lib/report/entry-adapter";
import { loadRange } from "@/lib/report/range-store";
import type { DateRange, ReportRow, ReportSummary } from "@/lib/report/types";
import { loadEntries, type Entry } from "@/lib/db";
import { classify, toAggregate, type DxResult, type Verdict } from "@/lib/ichd3";
import { runCauseFinder, loadProfile, type CauseReport } from "@/lib/cause-finder";
import "./print.css";

// toAggregate() may return DxResult[] (current blueprint) or a DiaryAggregate
// object; normalize to DxResult[] either way so the report can't break.
function resolveDxResults(entries: Entry[]): DxResult[] {
  const agg = toAggregate(entries) as unknown;
  if (agg == null) return [];
  if (Array.isArray(agg)) return agg as DxResult[];
  try {
    return (classify(agg) as unknown as DxResult[]) ?? [];
  } catch {
    return [];
  }
}

// Inline heat ramp (the design's only warm colors) for native printing.
const HEAT = [
  "#3a4750", // 0
  "#38938a", // 1
  "#3fb8a6", // 2
  "#6fc98f", // 3
  "#e8c15a", // 4
  "#e8b14e", // 5
  "#e89b43", // 6
  "#e57f45", // 7
  "#e0654b", // 8
  "#db4642", // 9
  "#d7263d", // 10
] as const;
const heat = (v: number) => HEAT[Math.max(0, Math.min(10, Math.round(v)))];

const verdictClass: Record<Verdict, string> = {
  MET: "met",
  PROBABLE: "probable",
  NEEDS_TEST: "needs_test",
  NOT_MET: "not_met",
};
const verdictLabel: Record<Verdict, string> = {
  MET: "Criteria met",
  PROBABLE: "Probable",
  NEEDS_TEST: "Needs clinical test",
  NOT_MET: "Not met",
};

function fmtDuration(min: number): string {
  if (!min) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function PrintReportPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [dx, setDx] = useState<DxResult[]>([]);
  const [cause, setCause] = useState<CauseReport | null>(null);

  // Load data inside an effect — IndexedDB + window are client-only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await loadEntries();
      const range: DateRange = loadRange() ?? { kind: "last30" };
      const builtRows = buildReportRows(entriesToDiaryEntries(entries), range);
      const results = resolveDxResults(entries).filter(
        (r) => r.verdict !== "NOT_MET"
      );
      const causeReport = runCauseFinder(entries, loadProfile());
      if (cancelled) return;
      setDx(results);
      setCause(causeReport);
      setRows(builtRows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire print after rows render + fonts are ready. afterprint -> back.
  // iOS afterprint is flaky, so we never strand the user (visible Back button).
  useEffect(() => {
    if (!rows) return;
    // Auto-print only when explicitly requested (?auto=1, set by the Export
    // button). A bare visit shows the report so it can be reviewed first.
    const auto =
      new URLSearchParams(window.location.search).get("auto") === "1";
    if (!auto) return;
    let done = false;
    const back = () => {
      if (done) return;
      done = true;
      router.back();
    };
    window.addEventListener("afterprint", back);

    let rafId = 0;
    const fire = () => {
      rafId = requestAnimationFrame(() => window.print());
    };
    // Wait on fonts so Devanagari shaping is settled before the dialog opens.
    if (document.fonts?.ready) {
      document.fonts.ready.then(fire).catch(fire);
    } else {
      fire();
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("afterprint", back);
    };
  }, [rows, router]);

  if (!rows) {
    return <p style={{ padding: 24 }}>Preparing report…</p>;
  }

  const s: ReportSummary = summarize(rows);

  return (
    <>
      <div className="print-actions">
        <button
          type="button"
          className="print-back"
          onClick={() => router.back()}
          aria-label="Back"
        >
          ← Back
        </button>
        <button
          type="button"
          className="print-back"
          onClick={() => window.print()}
          aria-label="Print or save as PDF"
        >
          ⎙ Print / Save PDF
        </button>
      </div>

      <div className="report" lang="hi">
        <header className="report-head">
          <h1>Headache Diary — Doctor Report</h1>
          <p className="sub">
            Generated {new Date().toLocaleDateString()} · {s.days} day(s) ·{" "}
            {rows.length ? `${rows[0].date} → ${rows[rows.length - 1].date}` : "—"}
          </p>
        </header>

        <section className="summary">
          <div>
            <b>{s.headacheDays}</b>
            <span>Headache days</span>
          </div>
          <div>
            <b>{s.avgWorst}</b>
            <span>Avg worst /10</span>
          </div>
          <div>
            <b>{s.maxWorst}</b>
            <span>Peak /10</span>
          </div>
          <div>
            <b>{s.totalMeds}</b>
            <span>Med doses</span>
          </div>
        </section>

        {/* Inline trend bars — heat-colored, no chart lib */}
        <section className="trend">
          <h2>Daily worst /10</h2>
          <div className="bars">
            {rows.map((r) => (
              <div key={r.date} className="bar" title={`${r.date}: ${r.worst}`}>
                <span
                  style={{
                    height: `${Math.max(r.worst * 10, r.worst > 0 ? 4 : 0)}%`,
                    background: heat(r.worst),
                  }}
                />
              </div>
            ))}
          </div>
          <p className="legend">
            Each bar = one logged day, colored by worst pain (teal → red).
          </p>
        </section>

        <table className="grid">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Worst</th>
              <th>Regions (intensity)</th>
              <th>Duration</th>
              <th>Symptoms</th>
              <th>Meds</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td className="num">{r.date}</td>
                <td>{r.weekday}</td>
                <td className="num">{r.worst}</td>
                <td>{r.regions || "-"}</td>
                <td className="num">{fmtDuration(r.durationMin)}</td>
                <td>{r.symptoms || "-"}</td>
                <td>{r.meds || "-"}</td>
                <td className="note">{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ICHD-3 classification analysis */}
        <section className="ichd3 page-break" id="ichd3-analysis" data-slot="ichd3">
          <h2>ICHD-3 Classification Analysis</h2>
          <p className="intro">
            Deterministic aggregation of the logged pattern against published
            ICHD-3 criteria, for clinician review. Diagnoses requiring a clinical
            test (e.g. indomethacin trial, imaging, nerve block) are capped at
            “needs clinical test” and are never auto-concluded from the diary.
            Only diagnoses with at least a partial signal are shown.
          </p>

          {dx.length === 0 ? (
            <p className="intro">
              Not enough structured data yet to evaluate ICHD-3 criteria. Keep
              logging — the analysis fills in as the diary grows.
            </p>
          ) : (
            dx.map((d) => (
              <div className="dx" key={`${d.code}-${d.name}`}>
                <div className="dx-head">
                  <span className="dx-title">
                    {d.name} <span className="dx-code">ICHD-3 {d.code}</span>
                  </span>
                  <span className={`verdict ${verdictClass[d.verdict]}`}>
                    {verdictLabel[d.verdict]}
                  </span>
                </div>

                <ul className="crit-list">
                  {d.criteria.map((cr) => (
                    <li
                      key={cr.id}
                      className={cr.passed ? "pass" : "fail"}
                    >
                      <span className="mark">{cr.passed ? "✓" : "✗"}</span>
                      <span>
                        <b>{cr.id}.</b> {cr.text}
                        {cr.reason ? (
                          <span className="reason"> — {cr.reason}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                {d.missing.length > 0 && (
                  <p className="missing">
                    Unmet / notes: {d.missing.join(", ")}
                  </p>
                )}
                {d.needsTest && (
                  <p className="needs-test">⚑ {d.needsTest}</p>
                )}
              </div>
            ))
          )}

          <p className="disclaimer">
            <b>Decision support, not a diagnosis.</b> This report is a
            deterministic aggregation of published ICHD-3 criteria from
            self-logged diary data; it reads only structured fields, never the
            free-text notes, so multilingual notes can never change a verdict.
            Every primary-headache criterion ends with “not better accounted for
            by another ICHD-3 diagnosis,” which the engine assumes unless a
            clinician sets otherwise. Confirm with a clinician.
          </p>
        </section>

        {/* Cause Finder — secondary/fixable causes + suggested next steps */}
        {cause &&
          (cause.emergencies.length > 0 ||
            cause.redFlags.length > 0 ||
            cause.candidates.length > 0 ||
            cause.moh.atRisk ||
            cause.mismatch.present ||
            cause.workupGaps.length > 0) && (
            <section className="ichd3 page-break">
              <h2>Cause Finder — beyond the primary differential</h2>
              <p className="intro">
                Possible secondary / fixable causes and cranial neuralgias the
                logged pattern fits, with the test that confirms or excludes
                each. Decision support for clinician review — not a diagnosis.
              </p>

              {cause.emergencies.length > 0 && (
                <div className="dx">
                  <div className="dx-head">
                    <span className="dx-title">Red flags — assess urgently</span>
                  </div>
                  <ul className="crit-list">
                    {cause.emergencies.concat(cause.redFlags).map((f) => (
                      <li key={f.id} className="fail">
                        <span className="mark">⚑</span>
                        <span>
                          <b>{f.label}.</b> {f.detail} {f.action}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cause.emergencies.length === 0 && cause.redFlags.length > 0 && (
                <div className="dx">
                  <div className="dx-head">
                    <span className="dx-title">Worth flagging</span>
                  </div>
                  <ul className="crit-list">
                    {cause.redFlags.map((f) => (
                      <li key={f.id} className="fail">
                        <span className="mark">⚑</span>
                        <span>
                          <b>{f.label}.</b> {f.detail} {f.action}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cause.candidates.map((c) => (
                <div className="dx" key={c.id}>
                  <div className="dx-head">
                    <span className="dx-title">
                      {c.name}
                      {c.code && <span className="dx-code"> ICHD-3 {c.code}</span>}
                    </span>
                    <span className="verdict needs_test">
                      {c.urgency === "emergency"
                        ? "Emergency"
                        : c.urgency === "urgent"
                          ? "See soon"
                          : "Discuss"}
                    </span>
                  </div>
                  <ul className="crit-list">
                    {c.matched.map((m, i) => (
                      <li key={i} className="pass">
                        <span className="mark">✓</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="needs-test">
                    Test: {c.confirmingTest} · See: {c.specialist}
                  </p>
                  {c.note && <p className="missing">{c.note}</p>}
                </div>
              ))}

              {cause.moh.atRisk && (
                <div className="dx">
                  <div className="dx-head">
                    <span className="dx-title">Medication-overuse risk</span>
                  </div>
                  <p className="needs-test">{cause.moh.message}</p>
                </div>
              )}
              {cause.mismatch.present && (
                <div className="dx">
                  <div className="dx-head">
                    <span className="dx-title">Treatment-layer check</span>
                  </div>
                  <p className="needs-test">{cause.mismatch.message}</p>
                </div>
              )}
              {cause.workupGaps.length > 0 && (
                <div className="dx">
                  <div className="dx-head">
                    <span className="dx-title">Tests worth considering</span>
                  </div>
                  <ul className="crit-list">
                    {cause.workupGaps.map((g, i) => (
                      <li key={i} className="fail">
                        <span className="mark">▸</span>
                        <span>
                          <b>{g.test}.</b> {g.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
      </div>
    </>
  );
}
