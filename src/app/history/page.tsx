"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Entry } from "@/lib/db";
import { pullAndMerge } from "@/lib/db/sync";
import { heatVar } from "@/components/diary/PainScale";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Short, human one-liner summarizing an entry. */
function summarize(e: Entry): string {
  if (e.no_headache) return "No headache";
  const bits: string[] = [];
  if (e.laterality) bits.push(e.laterality === "unilateral" ? "one side" : "both sides");
  if (e.quality)
    bits.push(
      e.quality === "pressing_tightening" ? "pressing" : e.quality.replace(/_/g, " "),
    );
  const sym: string[] = [];
  if (e.nausea !== "none") sym.push("nausea");
  if (e.photophobia) sym.push("light");
  if (e.phonophobia) sym.push("sound");
  if (e.aura) sym.push("aura");
  if (sym.length) bits.push(sym.join(" / "));
  return bits.length ? bits.join(" · ") : "Logged";
}

function HeatDot({ value }: { value: number }) {
  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center rounded-2xl font-display text-lg tabular-nums"
      style={{
        background: `color-mix(in oklab, ${heatVar(value)} 22%, transparent)`,
        color: heatVar(value),
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${heatVar(value)} 45%, transparent)`,
      }}
    >
      {value}
    </span>
  );
}

export default function HistoryPage() {
  const entries = useLiveQuery(
    () => db.entries.orderBy("date").reverse().toArray(),
    [],
  );

  useEffect(() => {
    void pullAndMerge().catch((e) =>
      console.error("[sync] history pull failed", e),
    );
  }, []);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-safe">
      <header className="pt-4">
        <h1 className="font-display text-3xl leading-none">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every day you log builds the picture.
        </p>
      </header>

      {entries === undefined ? (
        <ul className="mt-6 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[72px] animate-pulse rounded-2xl bg-card/50" />
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>No entries yet.</p>
          <p className="mt-1">Log today on the Today tab.</p>
        </div>
      ) : (
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          className="mt-6 space-y-2"
        >
          {entries.map((e) => (
            <motion.li
              key={e.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3",
              )}
            >
              <HeatDot value={e.no_headache ? 0 : e.worst} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {formatDate(e.date)}
                  </span>
                  {e.regions.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {e.regions[0].regionLabel}
                      {e.regions.length > 1 ? ` +${e.regions.length - 1}` : ""}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {summarize(e)}
                  {e.note ? ` — ${e.note}` : ""}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </main>
  );
}
