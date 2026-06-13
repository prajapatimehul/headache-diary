"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { FileText, FileJson, Printer, CalendarRange } from "lucide-react";

import { buildReportRows, summarize } from "@/lib/report/build";
import { downloadCSV, downloadJSON } from "@/lib/report/download";
import { entriesToDiaryEntries } from "@/lib/report/entry-adapter";
import { saveRange } from "@/lib/report/range-store";
import type { DateRange, RangeKind } from "@/lib/report/types";
import { loadEntries } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS: Array<{ kind: RangeKind; label: string }> = [
  { kind: "last7", label: "7 days" },
  { kind: "last30", label: "30 days" },
  { kind: "all", label: "All" },
  { kind: "custom", label: "Custom" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ReportSetupPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [range, setRange] = useState<DateRange>({ kind: "last30" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customInvalid =
    range.kind === "custom" &&
    !!range.from &&
    !!range.to &&
    range.from > range.to;

  async function withEntries(run: (rows: ReturnType<typeof buildReportRows>) => void) {
    setError(null);
    setBusy(true);
    try {
      const entries = await loadEntries();
      const rows = buildReportRows(entriesToDiaryEntries(entries), range);
      if (rows.length === 0) {
        setError("No entries in this range yet. Log a day, then export.");
        return;
      }
      run(rows);
    } catch {
      setError("Could not read your diary. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const exportCSV = () => withEntries((rows) => downloadCSV(rows));
  const exportJSON = () => withEntries((rows) => downloadJSON(rows));

  function openPrint() {
    if (customInvalid) {
      setError("The “from” date is after the “to” date.");
      return;
    }
    saveRange(range);
    router.push("/report/print?auto=1");
  }

  const ease = [0.22, 1, 0.36, 1] as const;
  const enter = reduce
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.32, ease },
      };

  const presetButtons = useMemo(
    () =>
      PRESETS.map((p) => {
        const active = range.kind === p.kind;
        return (
          <button
            key={p.kind}
            type="button"
            aria-pressed={active}
            onClick={() =>
              setRange(
                p.kind === "custom"
                  ? { kind: "custom", from: range.from, to: range.to ?? todayISO() }
                  : { kind: p.kind }
              )
            }
            className={cn(
              "flex h-11 min-w-[4.5rem] flex-1 items-center justify-center rounded-xl border px-3 text-sm font-medium tabular-nums transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        );
      }),
    [range.kind, range.from, range.to]
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-8 pb-28">
      <motion.header {...enter} className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <CalendarRange className="size-3.5" />
          Doctor report
        </p>
        <h1 className="font-display text-3xl leading-tight text-foreground">
          Export your diary
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pick a window, then save a PDF, spreadsheet, or backup file. The PDF
          includes an ICHD-3 pattern review for your clinician.
        </p>
      </motion.header>

      <motion.section
        {...enter}
        transition={reduce ? undefined : { duration: 0.32, ease, delay: 0.05 }}
        className="space-y-4 rounded-2xl border border-border bg-card p-4"
      >
        <div>
          <h2 className="mb-2 text-sm font-medium text-foreground">Date range</h2>
          <div className="flex gap-2">{presetButtons}</div>
        </div>

        {range.kind === "custom" && (
          <div className="flex items-end gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">From</span>
              <input
                type="date"
                max={range.to ?? todayISO()}
                value={range.from ?? ""}
                onChange={(e) =>
                  setRange((r) => ({ ...r, kind: "custom", from: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <span className="pb-3 text-xs text-muted-foreground">to</span>
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">To</span>
              <input
                type="date"
                min={range.from}
                max={todayISO()}
                value={range.to ?? ""}
                onChange={(e) =>
                  setRange((r) => ({ ...r, kind: "custom", to: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          </div>
        )}
      </motion.section>

      <motion.section
        {...enter}
        transition={reduce ? undefined : { duration: 0.32, ease, delay: 0.1 }}
        className="space-y-3"
      >
        <Button
          size="lg"
          onClick={openPrint}
          disabled={busy || customInvalid}
          className="h-12 w-full rounded-xl text-base"
        >
          <Printer />
          PDF / Print
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={exportCSV}
            disabled={busy}
            className="h-12 rounded-xl text-base"
          >
            <FileText />
            CSV
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={exportJSON}
            disabled={busy}
            className="h-12 rounded-xl text-base"
          >
            <FileJson />
            JSON
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </motion.section>

      <p className="mt-auto text-center text-xs leading-relaxed text-muted-foreground">
        Decision support, not a diagnosis. Confirm with a clinician.
        <br />
        CSV opens in Excel / Google Sheets with Hindi &amp; Hinglish notes intact.
      </p>
    </main>
  );
}
